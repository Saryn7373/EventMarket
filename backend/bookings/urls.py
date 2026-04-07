from django.urls import path
from .views import (
    BookingListCreateView,
    BookingRetrieveUpdateDestroyView,
    BookingStatusView,
    MyBookingsView,
    VenueAvailabilityView,
)

urlpatterns = [
    # Список + создание
    path("", BookingListCreateView.as_view(), name="booking-list"),

    # Мои брони (удобный alias)
    path("my/", MyBookingsView.as_view(), name="booking-my"),

    # Детали + изменение дат + удаление (→ отмена)
    path("<uuid:pk>/", BookingRetrieveUpdateDestroyView.as_view(), name="booking-detail"),

    # Смена статуса — отдельный эндпоинт, чтобы не смешивать с данными
    path("<uuid:pk>/status/", BookingStatusView.as_view(), name="booking-status"),
]

# Эндпоинт доступности площадки регистрируется в venues/urls.py:
#
#   path("<uuid:venue_id>/availability/", VenueAvailabilityView.as_view(), ...)
#
# Но можно импортировать и отсюда:
availability_urlpatterns = [
    path(
        "<uuid:venue_id>/availability/",
        VenueAvailabilityView.as_view(),
        name="venue-availability",
    ),
]