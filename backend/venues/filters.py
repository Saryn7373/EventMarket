import django_filters
from .models import Venue


class VenueFilter(django_filters.FilterSet):
    city           = django_filters.CharFilter(lookup_expr='icontains')
    status         = django_filters.ChoiceFilter(choices=Venue.STATUS_CHOICES)
    is_verified    = django_filters.BooleanFilter()
    capacity_min   = django_filters.NumberFilter(field_name='capacity_min', lookup_expr='gte')
    capacity_max   = django_filters.NumberFilter(field_name='capacity_max', lookup_expr='lte')
    price_hour_min = django_filters.NumberFilter(field_name='price_per_hour', lookup_expr='gte')
    price_hour_max = django_filters.NumberFilter(field_name='price_per_hour', lookup_expr='lte')
    price_day_min  = django_filters.NumberFilter(field_name='price_per_day',  lookup_expr='gte')
    price_day_max  = django_filters.NumberFilter(field_name='price_per_day',  lookup_expr='lte')
    description    = django_filters.CharFilter(field_name='description', lookup_expr='contains')

    # Фильтр «площадка вмещает не менее N гостей» (capacity_max >= guests)
    guests = django_filters.NumberFilter(field_name='capacity_max', lookup_expr='gte')

    # Фильтр доступности: исключает площадки с пересекающимися активными бронированиями
    available_from = django_filters.CharFilter(method='filter_available_from')
    available_to   = django_filters.CharFilter(method='filter_available_to')

    class Meta:
        model  = Venue
        fields = [
            'city', 'status', 'is_verified',
            'capacity_min', 'capacity_max',
            'price_hour_min', 'price_hour_max',
            'price_day_min', 'price_day_max',
            'guests',
            'available_from', 'available_to',
        ]

    # ── Фильтрация по доступности ────────────────────────────────────────────

    def _apply_availability(self, queryset):
        from_str = self.data.get('available_from')
        to_str   = self.data.get('available_to')
        if not from_str or not to_str:
            return queryset

        from django.utils.dateparse import parse_datetime
        from django.utils import timezone
        from bookings.models import Booking

        from_dt = parse_datetime(from_str)
        to_dt   = parse_datetime(to_str)
        if not from_dt or not to_dt:
            return queryset

        if timezone.is_naive(from_dt):
            from_dt = timezone.make_aware(from_dt)
        if timezone.is_naive(to_dt):
            to_dt = timezone.make_aware(to_dt)

        busy_ids = Booking.objects.filter(
            status__in=['pending', 'confirmed'],
            start_datetime__lt=to_dt,
            end_datetime__gt=from_dt,
        ).values_list('venue_id', flat=True)

        return queryset.exclude(id__in=busy_ids)

    def filter_available_from(self, queryset, name, value):
        return self._apply_availability(queryset)

    def filter_available_to(self, queryset, name, value):
        return self._apply_availability(queryset)
