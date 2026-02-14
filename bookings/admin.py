# bookings/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = [
        'short_id',
        'event_title',
        'venue_name',
        'renter_email',
        'colored_status',
        'start_datetime',
        'duration_display',
        'total_price_formatted',
        'created_at',
    ]
    
    list_display_links = ['short_id', 'event_title']
    
    list_filter = [
        'status',
        'created_at',
        'venue',
        'renter',
    ]
    
    search_fields = [
        'event__title',
        'venue__name',
        'renter__user__email',
        'renter__user__first_name',
        'renter__user__last_name',
    ]
    
    date_hierarchy = 'start_datetime'
    
    readonly_fields = ['created_at', 'updated_at', 'duration_hours']
    
    fieldsets = (
        (None, {
            'fields': ('event', 'venue', 'renter')
        }),
        ('Период и длительность', {
            'fields': ('start_datetime', 'end_datetime', 'duration_hours')
        }),
        ('Финансы и статус', {
            'fields': ('total_price', 'status')
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
    
    @admin.display(description='ID', ordering='id')
    def short_id(self, obj):
        return str(obj.id)[:8].upper()
    
    @admin.display(description='Мероприятие')
    def event_title(self, obj):
        if obj.event:
            url = reverse('admin:events_event_change', args=[obj.event.pk])
            return format_html('<a href="{}">{}</a>', url, obj.event.title or '(без названия)')
        return '—'
    
    @admin.display(description='Площадка')
    def venue_name(self, obj):
        return obj.venue.name if obj.venue else '—'
    
    @admin.display(description='Организатор')
    def renter_email(self, obj):
        if obj.renter and obj.renter.user:
            return obj.renter.user.email
        return '—'
    
    @admin.display(description='Статус', ordering='status')
    def colored_status(self, obj):
        colors = {
            'pending':   '#f0ad4e',  # оранжевый
            'confirmed': '#5cb85c',  # зелёный
            'cancelled': '#d9534f',  # красный
            'completed': '#0275d8',  # синий
        }
        color = colors.get(obj.status, '#777777')
        return format_html(
            '<span style="background-color: {}; color: white; '
            'padding: 4px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    
    @admin.display(description='Длительность', ordering='start_datetime')
    def duration_display(self, obj):
        hours = obj.duration_hours
        if hours is None:
            return '—'
        if hours == 1:
            return '1 час'
        elif 2 <= hours <= 4:
            return f'{hours} часа'
        else:
            return f'{hours} часов'
    
    @admin.display(description='Стоимость', ordering='total_price')
    def total_price_formatted(self, obj):
        if obj.total_price is None:
            return '—'
        return f'{obj.total_price:,.0f} ₽'
    
    # Оптимизация запросов (очень важно для производительности)
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'event',
            'venue',
            'renter__user'
        )