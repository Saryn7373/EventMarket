from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import uuid


class Event(models.Model):
    """
    Мероприятие / событие, которое создаёт арендатор (Renter)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    renter = models.ForeignKey(
        'users.Renter',
        on_delete=models.CASCADE,
        related_name='events',
        verbose_name=_("организатор")
    )

    title = models.CharField(_("название мероприятия"), max_length=200)
    
    date = models.DateField(_("дата проведения"))
    start_time = models.TimeField(_("время начала"), null=True, blank=True)
    end_time = models.TimeField(_("время окончания"), null=True, blank=True)

    # Основная тематика / формат
    THEME_CHOICES = [
        ('party',          _("вечеринка / день рождения")),
        ('wedding',        _("свадьба")),
        ('corporate',      _("корпоратив / тимбилдинг")),
        ('conference',     _("конференция / семинар")),
        ('workshop',       _("мастер-класс / тренинг")),
        ('photo_session',  _("фотосессия / съёмка")),
        ('concert',        _("концерт / выступление")),
        ('private',        _("закрытое мероприятие")),
        ('other',          _("другое")),
    ]

    theme = models.CharField(
        _("тематика / формат"),
        max_length=40,
        choices=THEME_CHOICES,
        default='other'
    )

    # Краткое описание (для карточки)
    short_description = models.CharField(
        _("короткое описание"),
        max_length=300,
        blank=True,
        help_text="до 300 символов, отображается в списке"
    )

    # Полное описание (если нужно)
    description = models.TextField(_("подробное описание"), blank=True)

    # Ожидаемое количество гостей
    expected_guests = models.PositiveSmallIntegerField(
        _("ожидаемое количество гостей"),
        default=20,
        help_text="примерное число участников"
    )

    # Статус мероприятия
    STATUS_CHOICES = [
        ('draft',      _("черновик")),
        ('planned',    _("запланировано")),
        ('active',     _("идёт подготовка")),
        ('ongoing',    _("проходит сейчас")),
        ('completed',  _("завершено")),
        ('cancelled',  _("отменено")),
    ]

    status = models.CharField(
        _("статус"),
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )

    created_at = models.DateTimeField(_("создано"), auto_now_add=True)
    updated_at = models.DateTimeField(_("обновлено"), auto_now=True)

    class Meta:
        verbose_name = _("мероприятие")
        verbose_name_plural = _("мероприятия")
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['date', 'status']),
            models.Index(fields=['renter']),
        ]

    def __str__(self):
        return f"{self.title} — {self.date.strftime('%d.%m.%Y')}"

    @property
    def is_upcoming(self):
        """Мероприятие ещё впереди"""
        if not self.date:
            return False
        event_date = timezone.datetime.combine(self.date, self.start_time or timezone.datetime.min.time())
        return event_date > timezone.now()

    @property
    def is_today(self):
        """Мероприятие сегодня"""
        return self.date == timezone.now().date()

    @property
    def duration(self):
        """Примерная продолжительность в часах"""
        if self.start_time and self.end_time:
            start = timezone.datetime.combine(self.date, self.start_time)
            end = timezone.datetime.combine(self.date, self.end_time)
            delta = end - start
            return round(delta.total_seconds() / 3600, 1)
        return None