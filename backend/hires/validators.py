from decimal import Decimal

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────
# Константы
# ─────────────────────────────────────────────────────────────

# Статусы найма, при которых специалист считается "занятым"
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

def validate_hire_datetimes(start_dt, end_dt) -> None:
    """
    Проверяет корректность дат:
    - start < end
    - найм не в прошлом
    """
    if start_dt >= end_dt:
        raise ValidationError(
            {"end_datetime": "Время окончания должно быть позже времени начала."}
        )

    if start_dt < timezone.now():
        raise ValidationError(
            {"start_datetime": "Нельзя нанять специалиста в прошлом."}
        )


# ─────────────────────────────────────────────────────────────
# Доступность специалиста (без блокировки БД — только проверка)
# ─────────────────────────────────────────────────────────────

def validate_specialist_availability(specialist, start_dt, end_dt, exclude_hire_id=None) -> None:
    """
    Проверяет, что специалист свободен в заданный интервал.

    Вызывать ВНУТРИ transaction.atomic() + select_for_update(),
    чтобы избежать race condition.
    """
    from hires.models import Hire  # локальный импорт — избегаем циклов

    qs = Hire.objects.filter(
        specialist=specialist,
        status__in=BLOCKING_STATUSES,
        start_datetime__lt=end_dt,
        end_datetime__gt=start_dt,
    )
    if exclude_hire_id:
        qs = qs.exclude(pk=exclude_hire_id)

    if qs.exists():
        raise ValidationError(
            {"non_field_errors": "Специалист уже занят в выбранный период."}
        )


# ─────────────────────────────────────────────────────────────
# Расчёт цены
# ─────────────────────────────────────────────────────────────

def calculate_hire_price(specialist, start_dt, end_dt) -> Decimal:
    """
    Рассчитывает стоимость найма специалиста.

    Логика:
    - Стоимость = часовая ставка * количество часов
    - Если hourly_rate не указан, используется базовая ставка 1000 ₽/час
    """
    import math

    duration_seconds = (end_dt - start_dt).total_seconds()
    hours = duration_seconds / 3600

    # Базовая часовая ставка (если не указана в модели specialist)
    # Можно расширить модель Specialist, добавив hourly_rate
    hourly_rate = getattr(specialist, 'hourly_rate', Decimal("1000.00"))

    # Округляем до 2 знаков после запятой
    price = (hourly_rate * Decimal(str(round(hours, 2)))).quantize(Decimal("0.01"))

    # Минимальная стоимость — 1 час
    if price < hourly_rate:
        price = hourly_rate

    return price


# ─────────────────────────────────────────────────────────────
# Принадлежность мероприятия арендатору
# ─────────────────────────────────────────────────────────────

def validate_event_belongs_to_renter(event, renter) -> None:
    """Арендатор может нанимать специалистов только для своих мероприятий."""
    if event.renter_id != renter.pk:
        raise ValidationError(
            {"event": "Вы можете нанимать специалистов только для своих мероприятий."}
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


def validate_status_transition_permissions(hire, new_status: str, user) -> None:
    """
    Проверяет, что именно этот пользователь вправе совершить данный переход.

    Правила:
    - confirmed  ← только Renter (владелец мероприятия)
    - cancelled  ← Renter (свой найм) или Specialist (свой найм)
    - completed  ← только Renter (владелец мероприятия)
    """
    is_renter = hasattr(user, "renter") and hire.event.renter == user.renter
    is_specialist = hasattr(user, "specialist") and hire.specialist == user.specialist

    if new_status == "confirmed":
        if not (is_renter or is_specialist):
            raise ValidationError(
                {"status": "Подтвердить найм может организатор мероприятия или специалист."}
            )

    elif new_status == "cancelled":
        if not (is_renter or is_specialist):
            raise ValidationError(
                {"status": "Отменить найм может только арендатор или специалист."}
            )

    elif new_status == "completed":
        if not is_renter:
            raise ValidationError(
                {"status": "Завершить найм может только организатор мероприятия."}
            )
