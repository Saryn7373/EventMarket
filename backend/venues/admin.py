# venues/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django import forms
from django.http import HttpResponse

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import os
from django.conf import settings

from .models import Venue, VenueImage

BASE_DIR_FONTS = os.path.join(settings.BASE_DIR, 'src/fonts')
pdfmetrics.registerFont(TTFont('DejaVu',            os.path.join(BASE_DIR_FONTS, 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DejaVu-Bold',       os.path.join(BASE_DIR_FONTS, 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DejaVu-Italic',     os.path.join(BASE_DIR_FONTS, 'DejaVuSans-Oblique.ttf')))
pdfmetrics.registerFont(TTFont('DejaVu-BoldItalic', os.path.join(BASE_DIR_FONTS, 'DejaVuSans-BoldOblique.ttf')))

from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily(
    'DejaVu',
    normal='DejaVu',
    bold='DejaVu-Bold',
    italic='DejaVu-Italic',
    boldItalic='DejaVu-BoldItalic',
)


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
    
    
    
    actions = ['export_venues_pdf'] 
    
    @admin.action(description="Экспортировать выбранные площадки в PDF")
    def export_venues_pdf(self, request, queryset):
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="venues_export.pdf"'

        doc = SimpleDocTemplate(
            response,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()

        # Кастомные стили
        title_style = ParagraphStyle(
            'VenueTitle',
            parent=styles['Heading1'],
            fontName='DejaVu',
            fontSize=16,
            spaceAfter=4,
            textColor=colors.HexColor('#2c3e50'),
        )
        section_style = ParagraphStyle(
            'SectionLabel',
            parent=styles['Normal'],
            fontName='DejaVu',
            fontSize=9,
            textColor=colors.HexColor('#7f8c8d'),
            spaceAfter=2,
        )
        value_style = ParagraphStyle(
            'Value',
            parent=styles['Normal'],
            fontName='DejaVu',
            fontSize=11,
            spaceAfter=6,
        )
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Normal'],
            fontName='DejaVu',
            fontSize=10,
            textColor=colors.white,
        )

        STATUS_COLORS = {
            'draft':       '#6c757d',
            'published':   '#28a745',
            'archived':    '#dc3545',
            'moderation':  '#ffc107',
        }

        story = []

        # Заголовок документа
        doc_title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Title'],
            fontName='DejaVu-Bold',
            fontSize=20,
        )
        story.append(Paragraph("Экспорт площадок — EventMarket", doc_title_style))
        story.append(Spacer(1, 0.5 * cm))

        for venue in queryset.select_related('owner__user'):
            # Название площадки
            story.append(Paragraph(venue.name, title_style))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#bdc3c7')))
            story.append(Spacer(1, 0.3 * cm))

            # Статус (цветная плашка через таблицу)
            status_color = colors.HexColor(STATUS_COLORS.get(venue.status, '#6c757d'))
            status_table = Table(
                [[Paragraph(venue.get_status_display(), header_style)]],
                colWidths=[4 * cm],
            )
            status_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), status_color),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                ('ROUNDEDCORNERS', [4]),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(status_table)
            story.append(Spacer(1, 0.4 * cm))

            # Основные данные — таблица из 2 колонок (label | value)
            label_p = ParagraphStyle('TLabel', fontName='DejaVu', fontSize=9,  textColor=colors.HexColor('#7f8c8d'))
            value_p = ParagraphStyle('TValue', fontName='DejaVu', fontSize=11, textColor=colors.HexColor('#2c3e50'))

            owner_email = venue.owner.user.email if venue.owner and venue.owner.user else '—'
            verified = '✓ Проверена' if venue.is_verified else '✗ Не проверена'

            def row(label, value):
                return [Paragraph(label, label_p), Paragraph(str(value), value_p)]

            rows = [
                row('Владелец',      owner_email),
                row('Адрес',         f"{venue.city}, {venue.address}"),
                row('Вместимость',   f"{venue.capacity_min}–{venue.capacity_max} чел."),
                row('Площадь',       f"{venue.area_sq_m} м²" if venue.area_sq_m else '—'),
                row('Цена за час',   f"{venue.price_per_hour:,.0f} ₽" if venue.price_per_hour else '—'),
                row('Цена за сутки', f"{venue.price_per_day:,.0f} ₽" if venue.price_per_day else '—'),
                row('Мин. бронь',    f"{venue.min_booking_hours} ч."),
                row('Верификация',   verified),
                row('Создана',       venue.created_at.strftime('%d.%m.%Y %H:%M')),
            ]

            table = Table(rows, colWidths=[5 * cm, 11 * cm])
            table.setStyle(TableStyle([
                ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#f8f9fa'), colors.white]),
                ('TOPPADDING',    (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING',   (0, 0), (0, -1), 0),
                ('LEFTPADDING',   (1, 0), (1, -1), 8),
                ('LINEBELOW',     (0, 0), (-1, -2), 0.5, colors.HexColor('#ecf0f1')),
            ]))
            story.append(table)
            story.append(Spacer(1, 0.4 * cm))

            # Описание
            if venue.short_description:
                story.append(Paragraph("Краткое описание", section_style))
                story.append(Paragraph(venue.short_description, value_style))

            if venue.cancellation_policy:
                story.append(Paragraph("Политика отмены", section_style))
                story.append(Paragraph(venue.cancellation_policy, value_style))

            story.append(Spacer(1, 0.8 * cm))
            story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2c3e50')))
            story.append(Spacer(1, 0.6 * cm))

        doc.build(story)
        return response
    
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