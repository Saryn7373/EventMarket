from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db import transaction

from EventMarket.pagination import StandardPagination
from .models import Payment
from .serializers import (
    PaymentListSerializer,
    PaymentDetailSerializer,
    PaymentCreateSerializer,
    PaymentStatusSerializer,
)
from .permissions import IsPaymentOwner, IsRenter
from .filters import PaymentFilter
from .validators import (
    validate_status_transition,
    validate_status_transition_permissions,
    validate_booking_payment,
    validate_hire_payment,
)


class PaymentListCreateView(generics.ListCreateAPIView):
    """
    Список платежей (GET) и создание нового платежа (POST)
    """

    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = PaymentFilter
    ordering_fields = ["created_at", "paid_at", "amount"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.select_related("payer__user", "booking__venue", "booking__event", "hire__specialist__user")

        # Арендатор видит только свои платежи
        if hasattr(user, "renter"):
            return qs.filter(payer=user.renter)

        # Администраторы видят все платежи
        if user.is_staff:
            return qs

        return qs.none()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PaymentCreateSerializer
        return PaymentListSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsRenter()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = PaymentCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            payment = serializer.save()

            # Дополнительная проверка: готов ли объект к оплате
            if payment.booking:
                validate_booking_payment(payment.booking)
            elif payment.hire:
                validate_hire_payment(payment.hire)

        return Response(
            PaymentDetailSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentRetrieveView(generics.RetrieveAPIView):
    """
    Детальная информация о платеже (GET)
    """

    queryset = Payment.objects.select_related(
        "payer__user", "booking__venue", "booking__event", "hire__specialist__user"
    )
    serializer_class = PaymentDetailSerializer
    permission_classes = [IsAuthenticated, IsPaymentOwner]


class PaymentStatusView(APIView):
    """
    Изменение статуса платежа (PATCH)

    Доступные переходы:
    - pending → succeeded, failed, cancelled
    - succeeded → refunded
    - failed → pending (повторная попытка)
    - cancelled → pending (повторная попытка)
    - refunded → (нет переходов)
    """

    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        payment = get_object_or_404(
            Payment.objects.select_related("payer__user"),
            pk=pk,
        )
        self.check_object_permissions(self.request, payment)
        return payment

    def patch(self, request, pk):
        payment = self.get_object(pk)

        with transaction.atomic():
            # Блокировка платежа от конкурентных изменений
            Payment.objects.select_for_update().filter(pk=payment.pk)

            serializer = PaymentStatusSerializer(
                data=request.data,
                context={"payment": payment, "request": request},
            )
            serializer.is_valid(raise_exception=True)

            # Проверка прав на смену статуса
            validate_status_transition_permissions(payment, serializer.validated_data["status"], request.user)

            updated = serializer.save()

        return Response(PaymentDetailSerializer(updated).data)


class MyPaymentsView(generics.ListAPIView):
    """
    Список платежей текущего арендатора (Renter)
    """

    serializer_class = PaymentListSerializer
    permission_classes = [IsRenter]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = PaymentFilter
    ordering_fields = ["created_at", "paid_at", "amount"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Payment.objects.filter(
            payer=self.request.user.renter
        ).select_related("payer__user", "booking__venue", "booking__event", "hire__specialist__user")


class BookingPaymentsView(generics.ListAPIView):
    """
    Список платежей по бронированию (GET)
    """

    serializer_class = PaymentListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from bookings.models import Booking

        booking_id = self.kwargs["booking_id"]
        booking = get_object_or_404(Booking, pk=booking_id)

        # Проверка: пользователь имеет право видеть платежи бронирования
        user = self.request.user
        if hasattr(user, "renter") and booking.renter == user.renter:
            return Payment.objects.filter(booking=booking)
        if hasattr(user, "owner") and booking.venue.owner == user.owner:
            return Payment.objects.filter(booking=booking)
        if user.is_staff:
            return Payment.objects.filter(booking=booking)

        return Payment.objects.none()


class HirePaymentsView(generics.ListAPIView):
    """
    Список платежей по найму (GET)
    """

    serializer_class = PaymentListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from hires.models import Hire

        hire_id = self.kwargs["hire_id"]
        hire = get_object_or_404(Hire, pk=hire_id)

        # Проверка: пользователь имеет право видеть платежи найма
        user = self.request.user
        if hasattr(user, "renter") and hire.event.renter == user.renter:
            return Payment.objects.filter(hire=hire)
        if hasattr(user, "specialist") and hire.specialist == user.specialist:
            return Payment.objects.filter(hire=hire)
        if user.is_staff:
            return Payment.objects.filter(hire=hire)

        return Payment.objects.none()
