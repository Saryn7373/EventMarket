import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


REVIEW_STATUS_CHOICES = [
    ('pending', _("на проверке")),
    ('approved', _("опубликован")),
    ('rejected', _("отклонён")),
]


class VenueReview(models.Model):
    """
    Отзыв арендатора о площадке.

    Оставить можно только если у арендатора есть завершённое
    бронирование этой площадки (см. reviews.validators).

    Перед публикацией отзыв проходит проверку администратором
    (status='pending'); публично виден только при status='approved'.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    status = models.CharField(
        _("статус модерации"),
        max_length=20,
        choices=REVIEW_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )

    venue = models.ForeignKey(
        'venues.Venue',
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name=_("площадка"),
    )
    renter = models.ForeignKey(
        'users.Renter',
        on_delete=models.CASCADE,
        related_name='venue_reviews',
        verbose_name=_("арендатор"),
    )

    rating = models.PositiveSmallIntegerField(
        _("оценка"),
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(_("комментарий"), blank=True)

    created_at = models.DateTimeField(_("создан"), auto_now_add=True)
    updated_at = models.DateTimeField(_("обновлён"), auto_now=True)

    class Meta:
        verbose_name = _("отзыв о площадке")
        verbose_name_plural = _("отзывы о площадках")
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['venue', 'renter'],
                name='unique_venue_review_per_renter',
            ),
        ]

    def __str__(self) -> str:
        return f"Отзыв {self.renter.user.email} о «{self.venue.name}» — {self.rating}/5"


class SpecialistReview(models.Model):
    """
    Отзыв арендатора о специалисте.

    Оставить можно только если есть мероприятие, организованное этим
    арендатором, в котором у специалиста был завершённый найм
    (см. reviews.validators).

    Перед публикацией отзыв проходит проверку администратором
    (status='pending'); публично виден только при status='approved'.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    status = models.CharField(
        _("статус модерации"),
        max_length=20,
        choices=REVIEW_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )

    specialist = models.ForeignKey(
        'users.Specialist',
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name=_("специалист"),
    )
    renter = models.ForeignKey(
        'users.Renter',
        on_delete=models.CASCADE,
        related_name='specialist_reviews',
        verbose_name=_("арендатор"),
    )

    rating = models.PositiveSmallIntegerField(
        _("оценка"),
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(_("комментарий"), blank=True)

    created_at = models.DateTimeField(_("создан"), auto_now_add=True)
    updated_at = models.DateTimeField(_("обновлён"), auto_now=True)

    class Meta:
        verbose_name = _("отзыв о специалисте")
        verbose_name_plural = _("отзывы о специалистах")
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['specialist', 'renter'],
                name='unique_specialist_review_per_renter',
            ),
        ]

    def __str__(self) -> str:
        name = f"{self.specialist.user.first_name} {self.specialist.user.last_name}".strip()
        return f"Отзыв {self.renter.user.email} о {name or self.specialist.user.email} — {self.rating}/5"
