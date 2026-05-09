from rest_framework import serializers

from .models import Booking
from .validators import (
    validate_booking_datetimes,
    validate_venue_availability,
    validate_event_belongs_to_renter,
    calculate_booking_price,
)


# ─────────────────────────────────────────────────────────────
# Вспомогательные вложенные сериализаторы (только для чтения)
# ─────────────────────────────────────────────────────────────

class _EventShortSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    date = serializers.DateField()
    theme = serializers.CharField(source="get_theme_display")


class _VenueShortSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    city = serializers.CharField()
    address = serializers.CharField()
    price_per_hour = serializers.DecimalField(max_digits=10, decimal_places=2)
    price_per_day = serializers.DecimalField(max_digits=12, decimal_places=2)


class _RenterShortSerializer(serializers.Serializer):
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")


# ─────────────────────────────────────────────────────────────
# Список (облегчённый)
# ─────────────────────────────────────────────────────────────

class BookingListSerializer(serializers.ModelSerializer):
    venue_id = serializers.UUIDField(source="venue.id", read_only=True)
    venue_name = serializers.CharField(source="venue.name", read_only=True)
    venue_city = serializers.CharField(source="venue.city", read_only=True)
    event_id = serializers.UUIDField(source="event.id", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_date = serializers.DateField(source="event.date", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    duration_hours = serializers.IntegerField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "venue_id",
            "venue_name",
            "venue_city",
            "event_id",
            "event_title",
            "event_date",
            "start_datetime",
            "end_datetime",
            "duration_hours",
            "total_price",
            "status",
            "status_display",
            "created_at",
        ]


# ─────────────────────────────────────────────────────────────
# Детальное представление (только чтение)
# ─────────────────────────────────────────────────────────────

class BookingDetailSerializer(serializers.ModelSerializer):
    venue = _VenueShortSerializer(read_only=True)
    event = _EventShortSerializer(read_only=True)
    renter = _RenterShortSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    duration_hours = serializers.IntegerField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "event",
            "venue",
            "renter",
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
# Создание брони
# ─────────────────────────────────────────────────────────────

class BookingCreateSerializer(serializers.ModelSerializer):
    """
    Принимает: venue, event, start_datetime, end_datetime.
    total_price и renter рассчитываются/берутся на сервере.
    """

    class Meta:
        model = Booking
        fields = ["venue", "event", "start_datetime", "end_datetime"]

    def validate(self, data):
        venue = data["venue"]
        start_dt = data["start_datetime"]
        end_dt = data["end_datetime"]

        # 1. Базовые проверки дат
        validate_booking_datetimes(start_dt, end_dt, venue)

        # 2. Площадка должна быть опубликована
        if venue.status != "published":
            raise serializers.ValidationError(
                {"venue": "Площадка недоступна для бронирования."}
            )

        # 3. Мероприятие принадлежит арендатору
        renter = self.context["request"].user.renter
        validate_event_belongs_to_renter(data["event"], renter)

        # 4. Нельзя бронировать для черновых и отменённых мероприятий
        if data["event"].status in ("draft", "cancelled"):
            raise serializers.ValidationError(
                {"event": "Нельзя бронировать площадки для черновых или отменённых мероприятий."}
            )

        # 4. Доступность площадки проверяется в save() внутри транзакции
        return data

    def create(self, validated_data):
        from django.db import transaction
        from bookings.models import Booking

        renter = self.context["request"].user.renter
        venue = validated_data["venue"]
        start_dt = validated_data["start_datetime"]
        end_dt = validated_data["end_datetime"]

        with transaction.atomic():
            # Блокируем конкурирующие строки бронирований этой площадки
            Booking.objects.select_for_update().filter(
                venue=venue,
                status__in=("pending", "confirmed"),
            )

            # Проверка доступности внутри транзакции
            validate_venue_availability(venue, start_dt, end_dt)

            # Цена фиксируется в момент бронирования
            price = calculate_booking_price(venue, start_dt, end_dt)

            return Booking.objects.create(
                renter=renter,
                total_price=price,
                **validated_data,
            )


# ─────────────────────────────────────────────────────────────
# Частичное обновление (только pending → арендатор может
# изменить даты до подтверждения)
# ─────────────────────────────────────────────────────────────

class BookingUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ["start_datetime", "end_datetime"]

    def validate(self, data):
        instance = self.instance
        venue = instance.venue
        start_dt = data.get("start_datetime", instance.start_datetime)
        end_dt = data.get("end_datetime", instance.end_datetime)

        validate_booking_datetimes(start_dt, end_dt, venue)
        return data

    def update(self, instance, validated_data):
        from django.db import transaction
        from bookings.models import Booking

        venue = instance.venue
        start_dt = validated_data.get("start_datetime", instance.start_datetime)
        end_dt = validated_data.get("end_datetime", instance.end_datetime)

        with transaction.atomic():
            Booking.objects.select_for_update().filter(
                venue=venue,
                status__in=("pending", "confirmed"),
            )
            validate_venue_availability(venue, start_dt, end_dt, exclude_booking_id=instance.pk)

            instance.start_datetime = start_dt
            instance.end_datetime = end_dt
            instance.total_price = calculate_booking_price(venue, start_dt, end_dt)
            instance.save()

        return instance


# ─────────────────────────────────────────────────────────────
# Смена статуса (отдельный эндпоинт)
# ─────────────────────────────────────────────────────────────

class BookingStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Booking.STATUS_CHOICES)

    def validate_status(self, new_status):
        from .validators import validate_status_transition, validate_status_transition_permissions

        booking = self.context["booking"]
        user = self.context["request"].user

        validate_status_transition(booking.status, new_status)
        validate_status_transition_permissions(booking, new_status, user)

        return new_status

    def save(self):
        booking = self.context["booking"]
        booking.status = self.validated_data["status"]
        booking.save(update_fields=["status", "updated_at"])
        return booking