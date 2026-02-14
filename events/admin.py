# events/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = [
        'short_id',
        'title_truncated',
        'date',
        'theme_display',
        'colored_status',
        'renter_email',
        'expected_guests',
        'is_upcoming_badge',
        'created_at',
    ]
    
    list_display_links = ['short_id', 'title_truncated']
    
    list_filter = [
        'status',
        'theme',
        'date',
        'renter',
        'created_at',
    ]
    
    search_fields = [
        'title',
        'short_description',
        'description',
        'renter__user__email',
        'renter__user__first_name',
        'renter__user__last_name',
    ]
    
    date_hierarchy = 'date'
    
    readonly_fields = ['created_at', 'updated_at', 'duration', 'is_upcoming', 'is_today']
    
    fieldsets = (
        (None, {
            'fields': ('renter', 'title', 'theme')
        }),
        ('Дата и время', {
            'fields': ('date', 'start_time', 'end_time', 'duration')
        }),
        ('Описание и участники', {
            'fields': ('short_description', 'description', 'expected_guests')
        }),
        ('Статус', {
            'fields': ('status',)
        }),
        ('Служебная информация', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    ordering = ['-date', '-created_at']
    
    # ────────────────────────────────────────────────
    # Кастомные колонки и отображение
    # ────────────────────────────────────────────────
    
    @admin.display(description='ID', ordering='id')
    def short_id(self, obj):
        return str(obj.id)[:8].upper()
    
    @admin.display(description='Название', ordering='title')
    def title_truncated(self, obj):
        return (obj.title[:60] + '...') if len(obj.title) > 60 else obj.title
    
    @admin.display(description='Тематика')
    def theme_display(self, obj):
        return obj.get_theme_display()
    
    @admin.display(description='Статус', ordering='status')
    def colored_status(self, obj):
        colors = {
            'draft':      '#6c757d',  # серый
            'planned':    '#17a2b8',  # голубой
            'active':     '#ffc107',  # жёлтый
            'ongoing':    '#28a745',  # зелёный
            'completed':  '#6f42c1',  # фиолетовый
            'cancelled':  '#dc3545',  # красный
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; '
            'padding: 4px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    
    @admin.display(description='Организатор')
    def renter_email(self, obj):
        if obj.renter and obj.renter.user:
            url = reverse('admin:users_renter_change', args=[obj.renter.pk])
            return format_html(
                '<a href="{}">{}</a>',
                url,
                obj.renter.user.email
            )
        return '—'
    
    @admin.display(description='Гостей', ordering='expected_guests')
    def expected_guests(self, obj):
        return f"{obj.expected_guests} чел."
    
    @admin.display(description='Скоро?', boolean=True)
    def is_upcoming_badge(self, obj):
        return obj.is_upcoming
    
    # Оптимизация запросов
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('renter__user')