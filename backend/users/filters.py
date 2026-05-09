import django_filters
from .models import Specialist


class SpecialistFilter(django_filters.FilterSet):
    # Минимальный рейтинг
    rating_min = django_filters.NumberFilter(field_name='rating', lookup_expr='gte')

    # Доступность: исключает специалистов с пересекающимися активными наймами
    available_from = django_filters.CharFilter(method='filter_available_from')
    available_to   = django_filters.CharFilter(method='filter_available_to')

    class Meta:
        model  = Specialist
        fields = ['rating_min', 'available_from', 'available_to']

    def _apply_availability(self, queryset):
        from_str = self.data.get('available_from')
        to_str   = self.data.get('available_to')
        if not from_str or not to_str:
            return queryset

        from django.utils.dateparse import parse_datetime
        from django.utils import timezone
        from hires.models import Hire

        from_dt = parse_datetime(from_str)
        to_dt   = parse_datetime(to_str)
        if not from_dt or not to_dt:
            return queryset

        if timezone.is_naive(from_dt):
            from_dt = timezone.make_aware(from_dt)
        if timezone.is_naive(to_dt):
            to_dt = timezone.make_aware(to_dt)

        busy_ids = Hire.objects.filter(
            status__in=['pending', 'confirmed'],
            start_datetime__lt=to_dt,
            end_datetime__gt=from_dt,
        ).values_list('specialist_id', flat=True)

        return queryset.exclude(user__id__in=busy_ids)

    def filter_available_from(self, queryset, name, value):
        return self._apply_availability(queryset)

    def filter_available_to(self, queryset, name, value):
        return self._apply_availability(queryset)
