# payments/admin.py
import csv
from django.contrib import admin
from django.http import HttpResponse
from django.utils.html import format_html
from django.utils import timezone

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'short_id',
        'target_display',
        'payer_email',
        'amount_formatted',
        'colored_status',
        'created_at',
        'paid_at',
    ]
    
    list_display_links = ['short_id', 'target_display']
    
    list_filter = [
        'status',
        'created_at',
        'paid_at',
    ]
    
    search_fields = [
        'payer__user__email',
        'payer__user__first_name',
        'payer__user__last_name',
        'booking__event__title',
        'hire__event__title',
    ]
    
    date_hierarchy = 'created_at'
    
    readonly_fields = ['created_at', 'paid_at']
    
    actions = ['export_as_csv']
    
    fieldsets = (
        (None, {
            'fields': ('payer', 'booking', 'hire')
        }),
        ('Сумма и статус', {
            'fields': ('amount', 'status', 'paid_at')
        }),
        ('Служебная информация', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    ordering = ['-created_at']
    
    # ────────────────────────────────────────────────
    # Кастомные колонки
    # ────────────────────────────────────────────────
    
    @admin.display(description='ID', ordering='id')
    def short_id(self, obj):
        return str(obj.id)[:8].upper()
    
    @admin.display(description='Связанный объект')
    def target_display(self, obj):
        if obj.booking:
            return f"Бронь {obj.booking.short_id if hasattr(obj.booking, 'short_id') else obj.booking.id}"
        if obj.hire:
            return f"Найм {obj.hire.id}"
        return '—'
    
    @admin.display(description='Плательщик')
    def payer_email(self, obj):
        if obj.payer and obj.payer.user:
            return obj.payer.user.email
        return '—'
    
    @admin.display(description='Сумма', ordering='amount')
    def amount_formatted(self, obj):
        return f'{obj.amount:,.0f} ₽'
    
    @admin.display(description='Статус', ordering='status')
    def colored_status(self, obj):
        colors = {
            'pending':   '#f0ad4e',  # оранжевый
            'succeeded': '#5cb85c',  # зелёный
            'failed':    '#d9534f',  # красный
            'cancelled': '#6c757d',  # серый
            'refunded':  '#0275d8',  # синий
        }
        color = colors.get(obj.status, '#777777')
        return format_html(
            '<span style="background-color: {}; color: white; '
            'padding: 4px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    
    # ────────────────────────────────────────────────
    # Действие: Экспорт в CSV
    # ────────────────────────────────────────────────
    
    @admin.action(description="Экспорт выбранных платежей в CSV")
    def export_as_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="payments_export.csv"'
        
        writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        
        # Заголовки
        writer.writerow([
            'ID', 
            'Плательщик (email)', 
            'Тип', 
            'Связанный объект', 
            'Сумма (₽)', 
            'Статус', 
            'Создан', 
            'Оплачен'
        ])
        
        # Данные
        for obj in queryset.select_related('payer__user', 'booking__event', 'hire__event'):
            target_type = 'Бронирование' if obj.booking else 'Найм' if obj.hire else '—'
            target_id = (
                f"{obj.booking.event.title[:40]}..." if obj.booking and obj.booking.event
                else f"{obj.hire.id}" if obj.hire
                else '—'
            )
            
            writer.writerow([
                str(obj.id)[:8].upper(),
                obj.payer.user.email if obj.payer and obj.payer.user else '—',
                target_type,
                target_id,
                f"{obj.amount:,.2f}".replace(',', ' ') if obj.amount else '—',
                obj.get_status_display(),
                obj.created_at.strftime('%Y-%m-%d %H:%M') if obj.created_at else '—',
                obj.paid_at.strftime('%Y-%m-%d %H:%M') if obj.paid_at else '—',
            ])
        
        return response
    
    # Оптимизация запросов
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'payer__user',
            'booking__event',
            'hire__event'
        )