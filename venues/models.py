from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
import uuid


class Venue(models.Model):
    """
    Площадка / Venue — место, которое сдаёт Owner
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        'users.Owner',
        on_delete=models.CASCADE,
        related_name='venues',
        verbose_name=_("владелец")
    )

    name = models.CharField(_("название площадки"), max_length=200)
    slug = models.SlugField(_("slug"), max_length=250, unique=True, help_text="для URL, например: loft-na-pokrovke")
    
    description = models.TextField(_("описание"), blank=True)
    short_description = models.CharField(_("короткое описание"), max_length=300, blank=True)
    
    # Адрес и геолокация
    address = models.CharField(_("адрес"), max_length=300)
    city = models.CharField(_("город"), max_length=100, db_index=True)
    postal_code = models.CharField(_("почтовый индекс"), max_length=20, blank=True)
    latitude = models.DecimalField(
        _("широта"), 
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True
    )
    longitude = models.DecimalField(
        _("долгота"), 
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True
    )

    # Основные характеристики
    capacity_min = models.PositiveIntegerField(
        _("минимальная вместимость"), 
        default=10,
        validators=[MinValueValidator(1)]
    )
    capacity_max = models.PositiveIntegerField(
        _("максимальная вместимость"),
        validators=[MinValueValidator(1)]
    )
    
    area_sq_m = models.PositiveIntegerField(
        _("площадь, м²"), 
        null=True, 
        blank=True
    )
    
    # Цена (базовая, за час / за сутки — можно расширять)
    price_per_hour = models.DecimalField(
        _("цена за час"), 
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[MinValueValidator(0)]
    )
    price_per_day = models.DecimalField(
        _("цена за сутки"), 
        max_digits=12, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[MinValueValidator(0)]
    )
    
    # Типы мероприятий, для которых подходит площадка
    # EVENT_TYPES = [
    #     ('conference', _("конференция / семинар")),
    #     ('party',      _("вечеринка / день рождения")),
    #     ('wedding',    _("свадьба")),
    #     ('photo',      _("фотосессия / съёмка")),
    #     ('workshop',   _("мастер-класс / тренинг")),
    #     ('concert',    _("концерт / выступление")),
    #     ('corporate',  _("корпоратив")),
    #     ('other',      _("другое")),
    # ]
    
    # suitable_for = models.ManyToManyField(
    #     'self',
    #     symmetrical=False,
    #     blank=True,
    #     verbose_name=_("подходит для типов мероприятий"),
    #     related_name='suitable_venues'
    # )
    
    
    # Правила / ограничения
    min_booking_hours = models.PositiveSmallIntegerField(
        _("минимальное бронирование, часов"), 
        default=2
    )
    cancellation_policy = models.TextField(
        _("политика отмены"), 
        blank=True,
        help_text="например: бесплатная отмена за 48 часов"
    )
    
    # Статус площадки
    STATUS_CHOICES = [
        ('draft',     _("черновик")),
        ('published', _("опубликовано")),
        ('archived',  _("в архиве")),
        ('moderation',_("на модерации")),
    ]
    status = models.CharField(
        _("статус"), 
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='draft',
        db_index=True
    )
    
    is_verified = models.BooleanField(_("проверена администратором"), default=False)
    
    # Временные метки
    created_at = models.DateTimeField(_("создана"), auto_now_add=True)
    updated_at = models.DateTimeField(_("обновлена"), auto_now=True)

    class Meta:
        verbose_name = _("площадка")
        verbose_name_plural = _("площадки")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['city', 'status']),
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return f"{self.name} ({self.city})"

    def get_absolute_url(self):
        # пример — если используешь slug
        from django.urls import reverse
        return reverse('venues:detail', kwargs={'slug': self.slug})

    @property
    def main_photo(self):
        # если добавишь модель VenueImage
        photo = self.images.order_by('order', '-created_at').first()
        return photo.image.url if photo else None

class VenueImage(models.Model):
    venue = models.ForeignKey(Venue, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(_("фото"), upload_to='venues/%Y/%m/')
    order = models.PositiveSmallIntegerField(_("порядок"), default=0)
    caption = models.CharField(_("подпись"), max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']