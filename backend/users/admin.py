# users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.urls import reverse

from .models import Admin, BaseUser, Renter, Owner, Specialist


@admin.register(BaseUser)
class BaseUserAdmin(BaseUserAdmin):
    list_display = [
        'short_id',
        'email',
        'role_badge',
        'is_active_colored',
        'is_staff',
        'date_joined',
    ]
    
    list_display_links = ['short_id', 'email']
    
    list_filter = ['is_active', 'is_staff', 'date_joined']
    search_fields = ['email']
    date_hierarchy = 'date_joined'
    
    readonly_fields = ['date_joined', 'last_login', 'role_readonly']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Права и статус', {
            'fields': ('is_active', 'is_staff', 'is_superuser')
        }),
        ('Даты', {
            'fields': ('date_joined', 'last_login')
        }),
        ('Роль', {
            'fields': ('role_readonly',),           # ← новое readonly-поле
            'classes': ('collapse',)
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'is_active', 'is_staff'),
        }),
    )
    
    ordering = ['-date_joined']
    
    # Методы для list_display
    @admin.display(description='ID', ordering='id')
    def short_id(self, obj):
        return str(obj.id)[:8].upper()
    
    @admin.display(description='Роль')
    def role_badge(self, obj):
        role = obj.role
        colors = {
            'Администратор':'#dc3545',
            'Арендатор':   '#28a745',
            'Владелец':    '#007bff',
            'Специалист':  '#ffc107',
            'Без роли':    '#6c757d',
        }
        color = colors.get(role, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color, role
        )
    
    @admin.display(description='Активен', boolean=True)
    def is_active_colored(self, obj):
        return obj.is_active
    
    # Метод специально для формы (readonly)
    @admin.display(description='Роль пользователя')
    def role_readonly(self, obj):
        return obj.role
    
    actions = ['make_admin', 'make_renter', 'make_owner', 'make_specialist']

    @admin.action(description="Выдать права Администратора")
    def make_admin(self, request, queryset):
        created = 0
        for user in queryset:
            if not hasattr(user, 'admin'):
                Admin.objects.create(user=user, granted_by=request.user)
                if not user.is_staff:
                    user.is_staff = True
                    user.save(update_fields=['is_staff'])
                created += 1
        self.message_user(request, f"Назначено администраторами: {created}")

    @admin.action(description="Сделать выбранных пользователей Арендаторами")
    def make_renter(self, request, queryset):
        for user in queryset:
            if not hasattr(user, 'renter'):
                Renter.objects.create(user=user)
        self.message_user(request, f"Сделано арендаторами: {queryset.count()} пользователей")

    @admin.action(description="Сделать выбранных пользователей Владельцами")
    def make_owner(self, request, queryset):
        for user in queryset:
            if not hasattr(user, 'owner'):
                Owner.objects.create(user=user, inn="", verified=False, rating=0.00)
        self.message_user(request, f"Сделано владельцами: {queryset.count()} пользователей")

    @admin.action(description="Сделать выбранных пользователей Специалистами")
    def make_specialist(self, request, queryset):
        for user in queryset:
            if not hasattr(user, 'specialist'):
                Specialist.objects.create(user=user, specialty="", license_number="", city="", rating=0.00)
        self.message_user(request, f"Сделано специалистами: {queryset.count()} пользователей")


# ────────────────────────────────────────────────
# Админка для профилей (Admin, Renter, Owner, Specialist)
# ────────────────────────────────────────────────

@admin.register(Admin)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ['user_email', 'granted_by_email', 'granted_at']
    search_fields = ['user__email']
    readonly_fields = ['user', 'granted_by', 'granted_at']

    @admin.display(description='Email', ordering='user__email')
    def user_email(self, obj):
        return obj.user.email if obj.user else '—'

    @admin.display(description='Кем назначен')
    def granted_by_email(self, obj):
        return obj.granted_by.email if obj.granted_by else '—'


@admin.register(Renter)
class RenterAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'user_date_joined',
    ]
    search_fields = ['user__email']
    readonly_fields = ['user']
    
    @admin.display(description='Email', ordering='user__email')
    def user_email(self, obj):
        return obj.user.email if obj.user else '—'
    
    @admin.display(description='Дата регистрации', ordering='user__date_joined')
    def user_date_joined(self, obj):
        return obj.user.date_joined if obj.user else '—'


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'inn',
        'verified',
        'rating',
        'user_date_joined',
    ]
    list_filter = ['verified']
    search_fields = ['user__email', 'inn']
    readonly_fields = ['user']
    
    @admin.display(description='Email', ordering='user__email')
    def user_email(self, obj):
        return obj.user.email if obj.user else '—'
    
    @admin.display(description='Дата регистрации', ordering='user__date_joined')
    def user_date_joined(self, obj):
        return obj.user.date_joined if obj.user else '—'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related('renter', 'owner', 'specialist')


@admin.register(Specialist)
class SpecialistAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'specialty',
        'city',
        'rating',
        'user_date_joined',
    ]
    list_filter = ['city', 'specialty']
    search_fields = ['user__email', 'specialty', 'city']
    readonly_fields = ['user']
    
    @admin.display(description='Email', ordering='user__email')
    def user_email(self, obj):
        return obj.user.email if obj.user else '—'
    
    @admin.display(description='Дата регистрации', ordering='user__date_joined')
    def user_date_joined(self, obj):
        return obj.user.date_joined if obj.user else '—'

class RenterInline(admin.StackedInline):
    model = Renter
    can_delete = False
    verbose_name_plural = 'Профиль Арендатора'
    extra = 0
    fields = ('user',)


class OwnerInline(admin.StackedInline):
    model = Owner
    can_delete = False
    verbose_name_plural = 'Профиль Владельца'
    extra = 0
    fields = ('inn', 'verified', 'rating')


class SpecialistInline(admin.StackedInline):
    model = Specialist
    can_delete = False
    verbose_name_plural = 'Профиль Специалиста'
    extra = 0
    fields = ('specialty', 'license_number', 'city', 'rating')