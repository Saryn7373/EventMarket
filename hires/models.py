# hires/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


class Hire(models.Model):
    """
    Найм специалиста на конкретное мероприятие
    """
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        related_name='hires',
        verbose_name=_("мероприятие")
    )

    specialist = models.ForeignKey(
        'users.Specialist',
        on_delete=models.PROTECT,
        related_name='hires',
        verbose_name=_("специалист")
    )

    renter = models.ForeignKey(
        'users.Renter',
        on_delete=models.PROTECT,
        related_name='hires',
        verbose_name=_("заказчик / организатор")
    )

    # Период работы специалиста
    start_datetime = models.DateTimeField(_("начало работы"))
    end_datetime   = models.DateTimeField(_("окончание работы"))

    # Стоимость услуг специалиста
    total_price = models.DecimalField(
        _("итоговая стоимость услуг"),
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Статус найма
    STATUS_CHOICES = [
        ('pending',   _("ожидает подтверждения")),
        ('confirmed', _("подтверждено")),
        ('cancelled', _("отменено")),
        ('completed', _("выполнено")),
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
        verbose_name = _("найм специалиста")
        verbose_name_plural = _("наймы специалистов")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['event', 'specialist']),
        ]

    def __str__(self):
        return f"Найм {self.id} — {self.specialist} — {self.event.date}"

    @property
    def duration_hours(self):
        """Примерное количество часов работы"""
        if self.start_datetime and self.end_datetime:
            delta = self.end_datetime - self.start_datetime
            return max(1, round(delta.total_seconds() / 3600))
        return None