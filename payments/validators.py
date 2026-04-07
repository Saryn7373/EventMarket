from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from decimal import Decimal


def validate_payment_target(booking, hire):
    """
    Платёж должен быть привязан ровно к одному объекту: Booking или Hire.
    """
    if booking and hire:
        raise ValidationError(
            _("Нельзя создать платёж одновременно для бронирования и найма.")
        )
    if not booking and not hire:
        raise ValidationError(
            _("Платёж должен быть привязан к бронированию или найму.")
        )


def validate_status_transition(current_status, new_status):
    """
    Проверка допустимых переходов статусов платежа.

    Допустимые переходы:
    - pending → succeeded, failed, cancelled
    - succeeded → refunded
    - failed → pending (повторная попытка)
    - cancelled → pending (повторная попытка)
    - refunded → (нет переходов)
    """
    valid_transitions = {
        "pending": ["succeeded", "failed", "cancelled"],
        "succeeded": ["refunded"],
        "failed": ["pending"],
        "cancelled": ["pending"],
        "refunded": [],
    }

    allowed = valid_transitions.get(current_status, [])

    if new_status not in allowed:
        raise ValidationError(
            _(
                f'Нельзя изменить статус платежа с "{current_status}" на "{new_status}". '
                f'Доступные варианты: {", ".join(allowed) if allowed else "нет"}'
            )
        )


def validate_status_transition_permissions(payment, new_status, user):
    """
    Проверка: пользователь имеет право менять статус платежа.

    - Только владелец платежа (payer) может менять статус своих платежей
    - Администраторы могут менять любые статусы (проверка через is_staff)
    """
    if user.is_staff:
        return  # Администратор может всё

    if payment.payer.user != user:
        raise ValidationError(
            _("Вы не можете менять статус чужого платежа.")
        )


def calculate_payment_amount(booking=None, hire=None):
    """
    Рассчитать сумму платежа из total_price связанного объекта.

    Если total_price не установлен, возвращает 0.
    """
    if booking:
        return booking.total_price or Decimal("0.00")
    if hire:
        return hire.total_price or Decimal("0.00")
    return Decimal("0.00")


def validate_booking_payment(booking):
    """
    Проверка: бронирование готово к оплате.

    - Бронирование должно быть в статусе pending или confirmed
    - Бронирование должно иметь total_price
    """
    from bookings.models import Booking

    if booking.status not in ["pending", "confirmed"]:
        raise ValidationError(
            _(
                f"Бронирование в статусе '{booking.get_status_display()}' "
                f"не может быть оплачено."
            )
        )

    if not booking.total_price or booking.total_price <= 0:
        raise ValidationError(
            _("У бронирования не указана стоимость.")
        )


def validate_hire_payment(hire):
    """
    Проверка: найм готов к оплате.

    - Найм должен быть в статусе pending или confirmed
    - Найм должен иметь total_price
    """
    from hires.models import Hire

    if hire.status not in ["pending", "confirmed"]:
        raise ValidationError(
            _(
                f"Найм в статусе '{hire.get_status_display()}' "
                f"не может быть оплачен."
            )
        )

    if not hire.total_price or hire.total_price <= 0:
        raise ValidationError(
            _("У найма не указана стоимость.")
        )
