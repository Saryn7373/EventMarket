from django.db.models import QuerySet

import django_filters
from .models import Hire


class HireFilter(django_filters.FilterSet):
    """Фильтры для наймов специалистов"""

    status = django_filters.CharFilter(
        field_name="status",
        lookup_expr="exact",
        label="Статус найма",
    )
    specialist = django_filters.UUIDFilter(
        field_name="specialist__id",
        lookup_expr="exact",
        label="ID специалиста",
    )
    event = django_filters.UUIDFilter(
        field_name="event__id",
        lookup_expr="exact",
        label="ID мероприятия",
    )
    date_from = django_filters.DateTimeFilter(
        field_name="start_datetime",
        lookup_expr="gte",
        label="Начало с даты (ISO 8601)",
    )
    date_to = django_filters.DateTimeFilter(
        field_name="start_datetime",
        lookup_expr="lte",
        label="Начало по дату (ISO 8601)",
    )
    price_min = django_filters.NumberFilter(
        field_name="total_price",
        lookup_expr="gte",
        label="Минимальная стоимость",
    )
    price_max = django_filters.NumberFilter(
        field_name="total_price",
        lookup_expr="lte",
        label="Максимальная стоимость",
    )
    upcoming = django_filters.BooleanFilter(
        method="filter_upcoming",
        label="Только предстоящие",
    )

    class Meta:
        model = Hire
        fields = ["status", "specialist", "event"]

    def filter_upcoming(self, queryset: QuerySet[Hire], name: str, value: bool) -> QuerySet[Hire]:
        """Фильтрует только предстоящие наймы, если флаг установлен."""
        from django.utils import timezone

        if value:
            return queryset.filter(start_datetime__gte=timezone.now())
        return queryset
