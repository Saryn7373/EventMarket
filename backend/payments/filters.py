from django.db.models import QuerySet
import django_filters
from .models import Payment


class PaymentFilter(django_filters.FilterSet):
    """Фильтры для платежей"""

    status = django_filters.CharFilter(
        field_name="status",
        lookup_expr="exact",
        label="Статус платежа",
    )
    amount_min = django_filters.NumberFilter(
        field_name="amount",
        lookup_expr="gte",
        label="Минимальная сумма",
    )
    amount_max = django_filters.NumberFilter(
        field_name="amount",
        lookup_expr="lte",
        label="Максимальная сумма",
    )
    created_from = django_filters.DateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
        label="Создан с даты (ISO 8601)",
    )
    created_to = django_filters.DateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
        label="Создан по дату (ISO 8601)",
    )
    paid_from = django_filters.DateTimeFilter(
        field_name="paid_at",
        lookup_expr="gte",
        label="Оплачен с даты (ISO 8601)",
    )
    paid_to = django_filters.DateTimeFilter(
        field_name="paid_at",
        lookup_expr="lte",
        label="Оплачен по дату (ISO 8601)",
    )
    is_paid = django_filters.BooleanFilter(
        method="filter_is_paid",
        label="Только оплаченные",
    )

    class Meta:
        model = Payment
        fields = ["status"]

    def filter_is_paid(self, queryset: QuerySet[Payment], name: str, value: bool) -> QuerySet[Payment]:
        """Фильтрует только успешно оплаченные платежи, если значение истинно."""
        if value:
            return queryset.filter(status="succeeded")
        return queryset
