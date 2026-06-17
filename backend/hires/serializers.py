from rest_framework import serializers
from .models import Hire


# ─────────────────────────────────────────────────────────────
# Вспомогательные вложенные сериализаторы (только для чтения)
# ─────────────────────────────────────────────────────────────

class _EventShortSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    date = serializers.DateField()
    theme = serializers.CharField(source="get_theme_display")


class _SpecialistShortSerializer(serializers.Serializer):
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    specialty = serializers.CharField()
    rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)


class _RenterShortSerializer(serializers.Serializer):
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")


# ─────────────────────────────────────────────────────────────
# Список (облегчённый)
# ─────────────────────────────────────────────────────────────

class HireListSerializer(serializers.ModelSerializer):
    event_id = serializers.UUIDField(source="event.id", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_date = serializers.DateField(source="event.date", read_only=True)
    specialist_name = serializers.SerializerMethodField()
    specialist_specialty = serializers.CharField(source="specialist.specialty", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    duration_hours = serializers.IntegerField(read_only=True)

    class Meta:
        model = Hire
        fields = [
            "id",
            "event_id",
            "event_title",
            "event_date",
            "specialist_name",
            "specialist_specialty",
            "start_datetime",
            "end_datetime",
            "duration_hours",
            "total_price",
            "status",
            "status_display",
            "created_at",
        ]

    def get_specialist_name(self, obj: Hire) -> str:
        """Возвращает полное имя специалиста."""
        return f"{obj.specialist.user.first_name} {obj.specialist.user.last_name}".strip()


# ─────────────────────────────────────────────────────────────
# Детальное представление (только чтение)
# ─────────────────────────────────────────────────────────────

class HireDetailSerializer(serializers.ModelSerializer):
    event = _EventShortSerializer(read_only=True)
    specialist = _SpecialistShortSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    duration_hours = serializers.IntegerField(read_only=True)

    class Meta:
        model = Hire
        fields = [
            "id",
            "event",
            "specialist",
            "start_datetime",
            "end_datetime",
            "duration_hours",
            "total_price",
            "status",
            "status_display",
            "created_at",
            "updated_at",
        ]


# ─────────────────────────────────────────────────────────────
# Создание найма
# ─────────────────────────────────────────────────────────────

class HireCreateSerializer(serializers.ModelSerializer):
    """
    Принимает: specialist (user UUID), event, start_datetime, end_datetime.
    total_price рассчитывается на сервере.
    """

    # Принимаем user.id специалиста (то же значение, что возвращает SpecialistDetailSerializer)
    specialist = serializers.UUIDField()

    class Meta:
        model = Hire
        fields = ["specialist", "event", "start_datetime", "end_datetime"]

    def validate_specialist(self, user_id):
        """Преобразует переданный user_id специалиста в объект Specialist."""
        from users.models import Specialist as SpecialistModel
        try:
            return SpecialistModel.objects.get(user_id=user_id)
        except SpecialistModel.DoesNotExist:
            raise serializers.ValidationError("Специалист не найден.")

    def validate(self, data: dict) -> dict:
        """Проверяет даты, принадлежность мероприятия арендатору и доступность специалиста."""
        from .validators import (
            validate_hire_datetimes,
            validate_event_belongs_to_renter,
            validate_specialist_availability,
        )

        specialist = data["specialist"]  # уже Specialist-объект после validate_specialist
        event = data["event"]
        start_dt = data["start_datetime"]
        end_dt = data["end_datetime"]

        validate_hire_datetimes(start_dt, end_dt)

        renter = self.context["request"].user.renter
        validate_event_belongs_to_renter(event, renter)

        # Нельзя нанимать для черновых и отменённых мероприятий
        if event.status in ("draft", "cancelled"):
            raise serializers.ValidationError(
                {"event": "Нельзя нанимать специалистов для черновых или отменённых мероприятий."}
            )

        validate_specialist_availability(specialist, start_dt, end_dt)

        return data

    def create(self, validated_data: dict) -> Hire:
        """Создаёт найм внутри транзакции с блокировкой конкурирующих строк специалиста."""
        from django.db import transaction
        from .validators import calculate_hire_price

        specialist = validated_data["specialist"]
        start_dt = validated_data["start_datetime"]
        end_dt = validated_data["end_datetime"]

        with transaction.atomic():
            Hire.objects.select_for_update().filter(
                specialist=specialist,
                status__in=("pending", "confirmed"),
            )
            price = calculate_hire_price(specialist, start_dt, end_dt)
            return Hire.objects.create(
                total_price=price,
                **validated_data,
            )


# ─────────────────────────────────────────────────────────────
# Обновление найма (только даты, пока pending)
# ─────────────────────────────────────────────────────────────

class HireUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hire
        fields = ["start_datetime", "end_datetime"]

    def validate(self, data: dict) -> dict:
        """Проверяет новые даты найма и доступность специалиста на этот период."""
        from .validators import validate_hire_datetimes, validate_specialist_availability

        instance = self.instance
        specialist = instance.specialist
        start_dt = data.get("start_datetime", instance.start_datetime)
        end_dt = data.get("end_datetime", instance.end_datetime)

        validate_hire_datetimes(start_dt, end_dt)
        validate_specialist_availability(
            specialist, start_dt, end_dt, exclude_hire_id=instance.pk
        )

        return data

    def update(self, instance: Hire, validated_data: dict) -> Hire:
        """Обновляет даты найма и пересчитывает стоимость внутри транзакции."""
        from django.db import transaction
        from .validators import calculate_hire_price

        specialist = instance.specialist
        start_dt = validated_data.get("start_datetime", instance.start_datetime)
        end_dt = validated_data.get("end_datetime", instance.end_datetime)

        with transaction.atomic():
            Hire.objects.select_for_update().filter(
                specialist=specialist,
                status__in=("pending", "confirmed"),
            )

            validate_specialist_availability(
                specialist, start_dt, end_dt, exclude_hire_id=instance.pk
            )

            instance.start_datetime = start_dt
            instance.end_datetime = end_dt
            instance.total_price = calculate_hire_price(specialist, start_dt, end_dt)
            instance.save()

        return instance


# ─────────────────────────────────────────────────────────────
# Смена статуса (отдельный эндпоинт)
# ─────────────────────────────────────────────────────────────

class HireStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Hire.STATUS_CHOICES)

    def validate_status(self, new_status: str) -> str:
        """Проверяет допустимость перехода статуса по конечному автомату."""
        from .validators import validate_status_transition

        hire = self.context["hire"]
        validate_status_transition(hire.status, new_status)

        return new_status

    def save(self) -> Hire:
        """Сохраняет новый статус найма."""
        hire = self.context["hire"]
        hire.status = self.validated_data["status"]
        hire.save(update_fields=["status", "updated_at"])
        return hire
