from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid


class Payment(models.Model):
    """
    Платёж (одна запись = один платёж)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    booking = models.ForeignKey(
        'bookings.Booking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name="бронирование"
    )

    hire = models.ForeignKey(
        'hires.Hire',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name="найм специалиста"
    )

    # Кто заплатил
    payer = models.ForeignKey(
        'users.Renter',
        on_delete=models.PROTECT,
        related_name='payments',
        verbose_name="плательщик"
    )

    amount = models.DecimalField(
        _("сумма"),
        max_digits=10,
        decimal_places=2
    )

    # Статус
    STATUS_CHOICES = [
        ('pending',   _("ожидает оплаты")),
        ('succeeded', _("оплачено")),
        ('failed',    _("не удалось")),
        ('cancelled', _("отменён")),
        ('refunded',  _("возвращён")),
    ]

    status = models.CharField(
        _("статус"),
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )

    created_at = models.DateTimeField(_("создан"), auto_now_add=True)
    paid_at = models.DateTimeField(_("оплачен"), null=True, blank=True)

    class Meta:
        verbose_name = _("платёж")
        verbose_name_plural = _("платежи")
        ordering = ['-created_at']

    def __str__(self):
        target = self.booking or self.hire or "—"
        return f"Платёж {self.id} — {self.amount} ₽ — {target}"
    
    # def clean(self):
    #     if (self.booking is None) == (self.hire is None):
    #         raise ValidationError("Платёж должен быть привязан либо к Booking, либо к Hire (ровно один)")

    @property
    def is_paid(self):
        return self.status == 'succeeded'