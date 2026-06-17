from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.utils import timezone
from rest_framework.exceptions import ValidationError

if TYPE_CHECKING:
    from bookings.models import Booking
    from users.models import BaseUser, Renter
    from venues.models import Venue


# ─────────────────────────────────────────────────────────────
# Константы
# ─────────────────────────────────────────────────────────────

# Статусы брони, при которых площадка считается "занятой"
BLOCKING_STATUSES = ("pending", "confirmed")

# Допустимые переходы статусов (старый → [новые])
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "pending":   ["confirmed", "cancelled"],
    "confirmed": ["cancelled", "completed"],
    "cancelled": [],
    "completed": [],
}


# ─────────────────────────────────────────────────────────────
# Даты / время
# ─────────────────────────────────────────────────────────────

def validate_booking_datetimes(start_dt: datetime, end_dt: datetime, venue: "Venue") -> None:
    """
    Проверяет корректность дат:
    - start < end
    - бронь не в прошлом
    - соблюдение минимальной длительности площадки
    """
    if start_dt >= end_dt:
        raise ValidationError(
            {"end_datetime": "Время окончания должно быть позже времени начала."}
        )

    if start_dt < timezone.now():
        raise ValidationError(
            {"start_datetime": "Нельзя бронировать площадку в прошлом."}
        )

    min_hours = venue.min_booking_hours or 1
    duration_hours = (end_dt - start_dt).total_seconds() / 3600
    if duration_hours < min_hours:
        raise ValidationError(
            {
                "end_datetime": (
                    f"Минимальная длительность бронирования — {min_hours} ч. "
                    f"(выбрано {duration_hours:.1f} ч.)"
                )
            }
        )


# ─────────────────────────────────────────────────────────────
# Доступность площадки (без блокировки БД — только проверка)
# ─────────────────────────────────────────────────────────────

def validate_venue_availability(
    venue: "Venue", start_dt: datetime, end_dt: datetime, exclude_booking_id=None
) -> None:
    """
    Проверяет, что площадка свободна в заданный интервал.

    Вызывать ВНУТРИ transaction.atomic() + select_for_update(),
    чтобы избежать race condition.
    """
    from bookings.models import Booking  # локальный импорт — избегаем циклов

    qs = Booking.objects.filter(
        venue=venue,
        status__in=BLOCKING_STATUSES,
        start_datetime__lt=end_dt,
        end_datetime__gt=start_dt,
    )
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)

    if qs.exists():
        raise ValidationError(
            {"non_field_errors": "Площадка уже занята в выбранный период."}
        )


# ─────────────────────────────────────────────────────────────
# Расчёт цены
# ─────────────────────────────────────────────────────────────

def calculate_booking_price(venue: "Venue", start_dt: datetime, end_dt: datetime) -> Decimal:
    """
    Рассчитывает стоимость брони по тарифу площадки.

    Логика:
    - если задан price_per_hour — считаем по часам
    - если задан price_per_day — считаем по дням (округляем вверх)
    - если ни одного — ошибка
    """
    import math

    duration_seconds = (end_dt - start_dt).total_seconds()
    hours = duration_seconds / 3600

    if venue.price_per_hour:
        return (venue.price_per_hour * Decimal(str(round(hours, 2)))).quantize(
            Decimal("0.01")
        )

    if venue.price_per_day:
        days = math.ceil(hours / 24)
        return (venue.price_per_day * Decimal(str(days))).quantize(Decimal("0.01"))

    raise ValidationError(
        {"non_field_errors": "У площадки не указана цена. Свяжитесь с владельцем."}
    )


# ─────────────────────────────────────────────────────────────
# Принадлежность мероприятия арендатору
# ─────────────────────────────────────────────────────────────

def validate_event_belongs_to_renter(event, renter: "Renter") -> None:
    """Арендатор может бронировать только для своих мероприятий."""
    if event.renter_id != renter.pk:
        raise ValidationError(
            {"event": "Вы можете бронировать площадки только для своих мероприятий."}
        )


# ─────────────────────────────────────────────────────────────
# Переход статусов
# ─────────────────────────────────────────────────────────────

def validate_status_transition(current_status: str, new_status: str) -> None:
    """Проверяет, что переход статуса допустим по конечному автомату."""
    allowed = ALLOWED_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise ValidationError(
            {
                "status": (
                    f"Переход '{current_status}' → '{new_status}' недопустим. "
                    f"Допустимые переходы: {allowed or 'нет'}."
                )
            }
        )


def validate_status_transition_permissions(booking: "Booking", new_status: str, user: "BaseUser") -> None:
    """
    Проверяет, что именно этот пользователь вправе совершить данный переход.

    Правила:
    - confirmed  ← только Owner площадки
    - cancelled  ← Renter (своя бронь) или Owner площадки
    - completed  ← только Owner площадки
    """
    is_renter = hasattr(user, "renter") and booking.renter == user.renter
    is_venue_owner = hasattr(user, "owner") and booking.venue.owner == user.owner

    if new_status == "confirmed":
        if not is_venue_owner:
            raise ValidationError(
                {"status": "Подтвердить бронирование может только владелец площадки."}
            )

    elif new_status == "cancelled":
        if not (is_renter or is_venue_owner):
            raise ValidationError(
                {"status": "Отменить бронирование может только арендатор или владелец площадки."}
            )

    elif new_status == "completed":
        if not is_venue_owner:
            raise ValidationError(
                {"status": "Завершить бронирование может только владелец площадки."}
            )