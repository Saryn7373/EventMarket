import django_filters
from django.db.models import QuerySet
from django.utils import timezone
from datetime import datetime
from .models import Event


class EventFilter(django_filters.FilterSet):
    """Фильтры для мероприятий"""

    date_from = django_filters.DateFilter(
        field_name='date',
        lookup_expr='gte',
        label='Дата от (YYYY-MM-DD)'
    )
    date_to = django_filters.DateFilter(
        field_name='date',
        lookup_expr='lte',
        label='Дата до (YYYY-MM-DD)'
    )
    theme = django_filters.CharFilter(
        field_name='theme',
        lookup_expr='exact',
        label='Тематика'
    )
    status = django_filters.CharFilter(
        field_name='status',
        lookup_expr='exact',
        label='Статус'
    )
    upcoming = django_filters.BooleanFilter(
        method='filter_upcoming',
        label='Только предстоящие'
    )
    today = django_filters.BooleanFilter(
        method='filter_today',
        label='Только сегодняшние'
    )
    guests_min = django_filters.NumberFilter(
        field_name='expected_guests',
        lookup_expr='gte',
        label='Минимальное кол-во гостей'
    )
    guests_max = django_filters.NumberFilter(
        field_name='expected_guests',
        lookup_expr='lte',
        label='Максимальное кол-во гостей'
    )

    class Meta:
        model = Event
        fields = ['date', 'theme', 'status']

    def filter_upcoming(self, queryset: QuerySet[Event], name: str, value: bool) -> QuerySet[Event]:
        """Оставляет только мероприятия с датой не раньше сегодня"""
        if value:
            today = timezone.now().date()
            return queryset.filter(date__gte=today)
        return queryset

    def filter_today(self, queryset: QuerySet[Event], name: str, value: bool) -> QuerySet[Event]:
        """Оставляет только мероприятия, назначенные на сегодня"""
        if value:
            today = timezone.now().date()
            return queryset.filter(date=today)
        return queryset
