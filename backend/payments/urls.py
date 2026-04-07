from django.urls import path
from .views import (
    PaymentListCreateView,
    PaymentRetrieveView,
    PaymentStatusView,
    MyPaymentsView,
    BookingPaymentsView,
    HirePaymentsView,
)

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payment-list"),
    path("my/", MyPaymentsView.as_view(), name="payment-my"),
    path("<uuid:pk>/", PaymentRetrieveView.as_view(), name="payment-detail"),
    path("<uuid:pk>/status/", PaymentStatusView.as_view(), name="payment-status"),
    path("booking/<uuid:booking_id>/", BookingPaymentsView.as_view(), name="payment-booking"),
    path("hire/<uuid:hire_id>/", HirePaymentsView.as_view(), name="payment-hire"),
]
