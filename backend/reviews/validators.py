from typing import TYPE_CHECKING

from rest_framework.exceptions import ValidationError

if TYPE_CHECKING:
    from users.models import Renter, Specialist
    from venues.models import Venue


# ─────────────────────────────────────────────────────────────
# Проверки возможности оставить отзыв
# ─────────────────────────────────────────────────────────────

def can_review_venue(renter: "Renter", venue: "Venue") -> bool:
    """
    Арендатор может оставить отзыв о площадке, если у него есть
    завершённое бронирование этой площадки.
    """
    from bookings.models import Booking

    return Booking.objects.filter(
        renter=renter, venue=venue, status='completed',
    ).exists()


def can_review_specialist(renter: "Renter", specialist: "Specialist") -> bool:
    """
    Арендатор может оставить отзыв о специалисте, если есть мероприятие,
    организованное этим арендатором, в котором у специалиста был
    завершённый найм.
    """
    from hires.models import Hire

    return Hire.objects.filter(
        event__renter=renter, specialist=specialist, status='completed',
    ).exists()


def validate_can_review_venue(renter: "Renter", venue: "Venue") -> None:
    """Бросает ValidationError, если арендатору нельзя оставить отзыв об этой площадке."""
    if not can_review_venue(renter, venue):
        raise ValidationError(
            {"detail": "Оставить отзыв можно только после завершённого бронирования этой площадки."}
        )


def validate_can_review_specialist(renter: "Renter", specialist: "Specialist") -> None:
    """Бросает ValidationError, если арендатору нельзя оставить отзыв об этом специалисте."""
    if not can_review_specialist(renter, specialist):
        raise ValidationError(
            {"detail": "Оставить отзыв можно только если у вас есть мероприятие "
                        "с завершённым наймом этого специалиста."}
        )
