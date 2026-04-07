import django_filters
from .models import Booking


class BookingFilter(django_filters.FilterSet):
    # Фильтр по площадке
    venue = django_filters.UUIDFilter(field_name="venue__id")
    venue_city = django_filters.CharFilter(
        field_name="venue__city", lookup_expr="icontains"
    )

    # Фильтр по мероприятию
    event = django_filters.UUIDFilter(field_name="event__id")

    # Статус
    status = django_filters.ChoiceFilter(choices=Booking.STATUS_CHOICES)

    # Диапазон дат начала
    start_after = django_filters.DateTimeFilter(
        field_name="start_datetime", lookup_expr="gte"
    )
    start_before = django_filters.DateTimeFilter(
        field_name="start_datetime", lookup_expr="lte"
    )

    # Диапазон дат окончания
    end_after = django_filters.DateTimeFilter(
        field_name="end_datetime", lookup_expr="gte"
    )
    end_before = django_filters.DateTimeFilter(
        field_name="end_datetime", lookup_expr="lte"
    )

    # Диапазон стоимости
    price_min = django_filters.NumberFilter(
        field_name="total_price", lookup_expr="gte"
    )
    price_max = django_filters.NumberFilter(
        field_name="total_price", lookup_expr="lte"
    )

    # Дата создания брони
    created_after = django_filters.DateFilter(
        field_name="created_at", lookup_expr="date__gte"
    )
    created_before = django_filters.DateFilter(
        field_name="created_at", lookup_expr="date__lte"
    )

    class Meta:
        model = Booking
        fields = [
            "venue",
            "venue_city",
            "event",
            "status",
            "start_after",
            "start_before",
            "end_after",
            "end_before",
            "price_min",
            "price_max",
            "created_after",
            "created_before",
        ]