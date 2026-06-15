from django.contrib import admin

from .models import SpecialistReview, VenueReview


@admin.action(description="Одобрить (опубликовать) выбранные отзывы")
def approve_reviews(modeladmin, request, queryset):
    updated = queryset.update(status='approved')
    modeladmin.message_user(request, f"Опубликовано отзывов: {updated}")


@admin.action(description="Отклонить выбранные отзывы")
def reject_reviews(modeladmin, request, queryset):
    updated = queryset.update(status='rejected')
    modeladmin.message_user(request, f"Отклонено отзывов: {updated}")


@admin.register(VenueReview)
class VenueReviewAdmin(admin.ModelAdmin):
    list_display = ['short_id', 'venue', 'renter_email', 'rating', 'status', 'created_at']
    list_filter = ['status', 'rating', 'created_at']
    search_fields = ['venue__name', 'renter__user__email']
    raw_id_fields = ['venue', 'renter']
    ordering = ['-created_at']
    actions = [approve_reviews, reject_reviews]

    @admin.display(description='ID')
    def short_id(self, obj):
        return str(obj.id)[:8].upper()

    @admin.display(description='Арендатор')
    def renter_email(self, obj):
        return obj.renter.user.email

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('venue', 'renter__user')


@admin.register(SpecialistReview)
class SpecialistReviewAdmin(admin.ModelAdmin):
    list_display = ['short_id', 'specialist_name', 'renter_email', 'rating', 'status', 'created_at']
    list_filter = ['status', 'rating', 'created_at']
    search_fields = ['specialist__user__email', 'renter__user__email']
    raw_id_fields = ['specialist', 'renter']
    ordering = ['-created_at']
    actions = [approve_reviews, reject_reviews]

    @admin.display(description='ID')
    def short_id(self, obj):
        return str(obj.id)[:8].upper()

    @admin.display(description='Специалист')
    def specialist_name(self, obj):
        return obj.specialist.user.email

    @admin.display(description='Арендатор')
    def renter_email(self, obj):
        return obj.renter.user.email

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('specialist__user', 'renter__user')
