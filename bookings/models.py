from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid


class Booking(models.Model):
    """
    Бронирование площадки под мероприятие
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name=_("мероприятие")
    )

    venue = models.ForeignKey(
        'venues.Venue',
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name=_("площадка")
    )

    renter = models.ForeignKey(
        'users.Renter',
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name=_("арендатор")
    )

    # Период брони
    start_datetime = models.DateTimeField(_("начало"))
    end_datetime   = models.DateTimeField(_("окончание"))

    # Стоимость
    total_price = models.DecimalField(
        _("итоговая стоимость"),
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Статус
    STATUS_CHOICES = [
        ('pending',   _("ожидает подтверждения")),
        ('confirmed', _("подтверждено")),
        ('cancelled', _("отменено")),
        ('completed', _("завершено")),
    ]

    status = models.CharField(
        _("статус"),
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )

    created_at = models.DateTimeField(_("создано"), auto_now_add=True)
    updated_at = models.DateTimeField(_("обновлено"), auto_now=True)

    class Meta:
        verbose_name = _("бронирование")
        verbose_name_plural = _("бронирования")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['event', 'venue']),
        ]

    def __str__(self):
        return f"Бронь {self.id} — {self.venue.name} ({self.event.date})"

    @property
    def duration_hours(self):
        """Примерное количество часов (можно использовать для расчётов)"""
        if self.start_datetime and self.end_datetime:
            delta = self.end_datetime - self.start_datetime
            return max(1, round(delta.total_seconds() / 3600))
        return None