# venues/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django import forms

from .models import Venue, VenueImage


class VenueImageInline(admin.TabularInline):
    """
    Inline-форма для добавления/редактирования фотографий прямо на странице площадки
    """
    model = VenueImage
    extra = 1
    fields = ['image', 'order', 'caption', 'preview']
    readonly_fields = ['preview']
    
    @admin.display(description='Предпросмотр')
    def preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-height: 100px; border-radius: 4px;" />',
                obj.image.url
            )
        return "—"


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'city',
        'owner_email',
        'capacity_range',
        'price_display',
        'status_colored',
        'is_verified_badge',
        'created_at',
    ]
    
    list_display_links = ['name']
    
    list_filter = [
        'status',
        'is_verified',
        'city',
        'owner',
        'created_at',
    ]
    
    search_fields = [
        'name',
        'slug',
        'address',
        'city',
        'owner__user__email',
        'description',
    ]
    
    date_hierarchy = 'created_at'
    
    readonly_fields = ['created_at', 'updated_at', 'slug']
    
    inlines = [VenueImageInline]
    
    fieldsets = (
        (None, {
            'fields': ('owner', 'name', 'slug')
        }),
        ('Статус и проверка', {
            'fields': ('status', 'is_verified')
        }),
        ('Описание', {
            'fields': ('short_description', 'description')
        }),
        ('Адрес и геолокация', {
            'fields': ('address', 'city', 'postal_code', ('latitude', 'longitude'))
        }),
        ('Характеристики', {
            'fields': (
                ('capacity_min', 'capacity_max'),
                'area_sq_m',
                ('price_per_hour', 'price_per_day'),
                'min_booking_hours',
            )
        }),
        ('Правила', {
            'fields': ('cancellation_policy',)
        }),
        ('Служебная информация', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    ordering = ['-created_at']
    
    # ────────────────────────────────────────────────
    # Кастомные колонки и отображение
    # ────────────────────────────────────────────────
    
    @admin.display(description='Владелец')
    def owner_email(self, obj):
        if obj.owner and obj.owner.user:
            url = reverse('admin:users_owner_change', args=[obj.owner.pk])
            return format_html('<a href="{}">{}</a>', url, obj.owner.user.email)
        return '—'
    
    @admin.display(description='Вместимость')
    def capacity_range(self, obj):
        return f"{obj.capacity_min}–{obj.capacity_max} чел."
    
    @admin.display(description='Цена')
    def price_display(self, obj):
        parts = []
        if obj.price_per_hour:
            parts.append(f"{obj.price_per_hour:,.0f} ₽/ч")
        if obj.price_per_day:
            parts.append(f"{obj.price_per_day:,.0f} ₽/сут")
        return " / ".join(parts) or '—'
    
    @admin.display(description='Статус', ordering='status')
    def status_colored(self, obj):
        colors = {
            'draft':      '#6c757d',  # серый
            'published':  '#28a745',  # зелёный
            'archived':   '#dc3545',  # красный
            'moderation': '#ffc107',  # жёлтый
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    
    @admin.display(description='Проверено', boolean=True)
    def is_verified_badge(self, obj):
        return obj.is_verified
    
    # Оптимизация запросов
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('owner__user')


@admin.register(VenueImage)
class VenueImageAdmin(admin.ModelAdmin):
    list_display = [
        'venue_name',
        'preview_thumbnail',
        'order',
        'caption_short',
        'created_at',
    ]
    
    list_filter = ['venue', 'created_at']
    search_fields = ['venue__name', 'caption']
    
    readonly_fields = ['created_at', 'preview_full']
    
    fields = ['venue', 'image', 'preview_full', 'order', 'caption', 'created_at']
    
    @admin.display(description='Площадка')
    def venue_name(self, obj):
        return obj.venue.name
    
    @admin.display(description='Предпросмотр')
    def preview_thumbnail(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-height: 60px; border-radius: 4px;" />',
                obj.image.url
            )
        return '—'
    
    @admin.display(description='Предпросмотр (полный)')
    def preview_full(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-width: 500px; border-radius: 8px;" />',
                obj.image.url
            )
        return 'Нет изображения'
    
    @admin.display(description='Подпись (коротко)')
    def caption_short(self, obj):
        return (obj.caption[:60] + '...') if len(obj.caption) > 60 else obj.caption
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('venue')