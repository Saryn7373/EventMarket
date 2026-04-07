from rest_framework import serializers
from django.utils import timezone
from .models import Payment


# ─────────────────────────────────────────────────────────────
# Вспомогательные вложенные сериализаторы (только для чтения)
# ─────────────────────────────────────────────────────────────

class _BookingShortSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    venue_name = serializers.CharField(source="venue.name", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_date = serializers.DateField(source="event.date", read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


class _HireShortSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    specialist_name = serializers.SerializerMethodField()
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_date = serializers.DateField(source="event.date", read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    def get_specialist_name(self, obj):
        return f"{obj.specialist.user.first_name} {obj.specialist.user.last_name}".strip()


class _RenterShortSerializer(serializers.Serializer):
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")


# ─────────────────────────────────────────────────────────────
# Список (облегчённый)
# ─────────────────────────────────────────────────────────────

class PaymentListSerializer(serializers.ModelSerializer):
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "target_type",
            "target_id",
            "amount",
            "status",
            "status_display",
            "created_at",
            "paid_at",
        ]

    def get_target_type(self, obj):
        if obj.booking:
            return "booking"
        if obj.hire:
            return "hire"
        return None

    def get_target_id(self, obj):
        if obj.booking:
            return obj.booking.id
        if obj.hire:
            return obj.hire.id
        return None


# ─────────────────────────────────────────────────────────────
# Детальное представление (только чтение)
# ─────────────────────────────────────────────────────────────

class PaymentDetailSerializer(serializers.ModelSerializer):
    booking = _BookingShortSerializer(read_only=True)
    hire = _HireShortSerializer(read_only=True)
    payer = _RenterShortSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_paid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "booking",
            "hire",
            "payer",
            "amount",
            "status",
            "status_display",
            "is_paid",
            "created_at",
            "paid_at",
        ]
        read_only_fields = [
            "id", "booking", "hire", "payer", "amount",
            "status", "is_paid", "created_at", "paid_at",
        ]


# ─────────────────────────────────────────────────────────────
# Создание платежа
# ─────────────────────────────────────────────────────────────

class PaymentCreateSerializer(serializers.ModelSerializer):
    """
    Принимает: booking ИЛИ hire (но не оба одновременно).
    amount рассчитывается на сервере из total_price.
    payer берётся из request.user.
    """

    class Meta:
        model = Payment
        fields = ["booking", "hire"]

    def validate(self, data):
        from .validators import validate_payment_target

        booking = data.get("booking")
        hire = data.get("hire")

        # 1. Проверка: ровно один объект должен быть указан
        validate_payment_target(booking, hire)

        # 2. Проверка: нет ли уже активного платежа для этого объекта
        if booking:
            existing = Payment.objects.filter(
                booking=booking,
                status__in=["pending", "succeeded"],
            ).exists()
            if existing:
                raise serializers.ValidationError(
                    {"booking": "У этого бронирования уже есть активный платёж."}
                )
            # 3. Проверка: бронирование принадлежит арендатору
            request = self.context["request"]
            if booking.renter != request.user.renter:
                raise serializers.ValidationError(
                    {"booking": "Вы можете оплатить только свои бронирования."}
                )

        if hire:
            existing = Payment.objects.filter(
                hire=hire,
                status__in=["pending", "succeeded"],
            ).exists()
            if existing:
                raise serializers.ValidationError(
                    {"hire": "У этого найма уже есть активный платёж."}
                )
            # Проверка: найм принадлежит мероприятию арендатора
            request = self.context["request"]
            if hire.event.renter != request.user.renter:
                raise serializers.ValidationError(
                    {"hire": "Вы можете оплатить только наймы своих мероприятий."}
                )

        return data

    def create(self, validated_data):
        from django.db import transaction
        from .validators import calculate_payment_amount

        payer = self.context["request"].user.renter
        booking = validated_data.get("booking")
        hire = validated_data.get("hire")

        with transaction.atomic():
            # Рассчитываем сумму на сервере
            amount = calculate_payment_amount(booking, hire)

            return Payment.objects.create(
                payer=payer,
                amount=amount,
                booking=booking,
                hire=hire,
            )


# ─────────────────────────────────────────────────────────────
# Смена статуса (отдельный эндпоинт)
# ─────────────────────────────────────────────────────────────

class PaymentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Payment.STATUS_CHOICES)

    def validate_status(self, new_status):
        from .validators import validate_status_transition

        payment = self.context["payment"]
        validate_status_transition(payment.status, new_status)

        return new_status

    def save(self):
        payment = self.context["payment"]
        old_status = payment.status
        payment.status = self.validated_data["status"]

        # Если статус меняется на "succeeded", фиксируем время оплаты
        if new_status := self.validated_data["status"] == "succeeded" and old_status != "succeeded":
            payment.paid_at = timezone.now()

        payment.save(update_fields=["status", "paid_at", "updated_at"])
        return payment
