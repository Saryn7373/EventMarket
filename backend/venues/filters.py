import django_filters
from .models import Venue


class VenueFilter(django_filters.FilterSet):
    city            = django_filters.CharFilter(lookup_expr='icontains')
    status          = django_filters.ChoiceFilter(choices=Venue.STATUS_CHOICES)
    is_verified     = django_filters.BooleanFilter()
    capacity_min    = django_filters.NumberFilter(field_name='capacity_min', lookup_expr='gte')
    capacity_max    = django_filters.NumberFilter(field_name='capacity_max', lookup_expr='lte')
    price_hour_min  = django_filters.NumberFilter(field_name='price_per_hour', lookup_expr='gte')
    price_hour_max  = django_filters.NumberFilter(field_name='price_per_hour', lookup_expr='lte')
    price_day_min   = django_filters.NumberFilter(field_name='price_per_day',  lookup_expr='gte')
    price_day_max   = django_filters.NumberFilter(field_name='price_per_day',  lookup_expr='lte')
    description = django_filters.CharFilter(
        field_name='description',
        lookup_expr='contains'
    )
    class Meta:
        model  = Venue
        fields = [
            'city', 'status', 'is_verified',
            'capacity_min', 'capacity_max',
            'price_hour_min', 'price_hour_max',
            'price_day_min', 'price_day_max',
        ]