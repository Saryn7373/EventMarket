from django.db.models import QuerySet
from rest_framework import generics, filters, status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from EventMarket.pagination import StandardPagination
from .models import Booking
from .serializers import (
    BookingListSerializer,
    BookingDetailSerializer,
    BookingCreateSerializer,
    BookingUpdateSerializer,
    BookingStatusSerializer,
)
from .permissions import IsRenter, IsOwnerUser, IsBookingParticipant, CanModifyBooking
from .filters import BookingFilter


# ─────────────────────────────────────────────────────────────
# GET  /api/bookings/   — список
# POST /api/bookings/   — создать (только Renter)
# ─────────────────────────────────────────────────────────────

class BookingListCreateView(generics.ListCreateAPIView):
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = BookingFilter
    ordering_fields = ["start_datetime", "total_price", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self) -> QuerySet[Booking]:
        """Возвращает брони текущего пользователя: свои — для Renter, по своим площадкам — для Owner."""
        user = self.request.user

        qs = Booking.objects.select_related(
            "venue__owner__user",
            "event",
            "renter__user",
        )

        # Renter видит только свои брони
        if hasattr(user, "renter"):
            return qs.filter(renter=user.renter)

        # Owner видит брони по своим площадкам
        if hasattr(user, "owner"):
            return qs.filter(venue__owner=user.owner)

        return qs.none()

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор создания для POST, иначе сериализатор списка."""
        if self.request.method == "POST":
            return BookingCreateSerializer
        return BookingListSerializer

    def get_permissions(self) -> list[BasePermission]:
        """Создавать бронь может только Renter, читать список — любой авторизованный."""
        if self.request.method == "POST":
            return [IsRenter()]
        return [IsAuthenticated()]

    def create(self, request: Request, *args, **kwargs) -> Response:
        """Создаёт бронь и возвращает её детальное представление."""
        serializer = BookingCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        return Response(
            BookingDetailSerializer(booking).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────
# GET   /api/bookings/{id}/   — детали
# PATCH /api/bookings/{id}/   — изменить даты (только Renter, пока pending)
# DELETE /api/bookings/{id}/  — отменить и удалить (только Renter, пока pending)
# ─────────────────────────────────────────────────────────────

class BookingRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]

    queryset = Booking.objects.select_related(
        "venue__owner__user",
        "event",
        "renter__user",
    )

    def get_permissions(self) -> list[BasePermission]:
        """Читать может любой участник брони, изменять — только при праве на модификацию."""
        if self.request.method == "GET":
            return [IsBookingParticipant()]
        return [IsBookingParticipant(), CanModifyBooking()]

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор обновления для PATCH, иначе детальный сериализатор."""
        if self.request.method == "PATCH":
            return BookingUpdateSerializer
        return BookingDetailSerializer

    def patch(self, request: Request, *args, **kwargs) -> Response:
        """Обновляет даты брони и возвращает её детальное представление."""
        booking = self.get_object()
        serializer = BookingUpdateSerializer(
            booking, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(BookingDetailSerializer(updated).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """
        Физически удалять брони не стоит — меняем статус на cancelled.
        Удаление разрешено только если бронь ещё pending.
        """
        booking = self.get_object()
        if booking.status != "pending":
            return Response(
                {"detail": "Нельзя удалить уже подтверждённое бронирование. Используйте отмену."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = "cancelled"
        booking.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────
# PATCH /api/bookings/{id}/status/  — смена статуса
# ─────────────────────────────────────────────────────────────

class BookingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk) -> Booking:
        """Возвращает бронь по pk с проверкой прав доступа объекта."""
        from django.shortcuts import get_object_or_404

        booking = get_object_or_404(
            Booking.objects.select_related("venue__owner", "renter"),
            pk=pk,
        )
        self.check_object_permissions(self.request, booking)
        return booking

    def patch(self, request: Request, pk) -> Response:
        """Меняет статус брони согласно конечному автомату переходов."""
        booking = self.get_object(pk)

        serializer = BookingStatusSerializer(
            data=request.data,
            context={"booking": booking, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        return Response(BookingDetailSerializer(updated).data)


# ─────────────────────────────────────────────────────────────
# GET /api/bookings/my/          — брони текущего пользователя
# ─────────────────────────────────────────────────────────────

class MyBookingsView(generics.ListAPIView):
    serializer_class = BookingListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = BookingFilter
    ordering_fields = ["start_datetime", "total_price", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self) -> QuerySet[Booking]:
        """Возвращает брони текущего пользователя: свои — для Renter, по своим площадкам — для Owner."""
        user = self.request.user
        qs = Booking.objects.select_related("venue__owner__user", "event", "renter__user")

        if hasattr(user, "renter"):
            return qs.filter(renter=user.renter)
        if hasattr(user, "owner"):
            return qs.filter(venue__owner=user.owner)
        return qs.none()


# ─────────────────────────────────────────────────────────────
# GET /api/venues/{venue_id}/availability/  — занятые слоты
# ─────────────────────────────────────────────────────────────

class VenueAvailabilityView(APIView):
    """
    Возвращает список занятых периодов площадки.
    Публичный — без авторизации.

    Query params:
        ?from=2025-06-01&to=2025-06-30
    """

    def get(self, request: Request, venue_id) -> Response:
        """Возвращает список занятых интервалов площадки, опционально ограниченный диапазоном дат."""
        from datetime import datetime
        from django.shortcuts import get_object_or_404
        from venues.models import Venue

        venue = get_object_or_404(Venue, pk=venue_id, status="published")

        qs = Booking.objects.filter(
            venue=venue,
            status__in=("pending", "confirmed"),
        ).order_by("start_datetime")

        # Необязательный диапазон
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")

        if from_str:
            try:
                from_dt = datetime.fromisoformat(from_str)
                qs = qs.filter(end_datetime__gte=from_dt)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат параметра 'from'. Используйте ISO 8601."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if to_str:
            try:
                to_dt = datetime.fromisoformat(to_str)
                qs = qs.filter(start_datetime__lte=to_dt)
            except ValueError:
                return Response(
                    {"detail": "Неверный формат параметра 'to'. Используйте ISO 8601."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        slots = qs.values("start_datetime", "end_datetime", "status")
        return Response({"venue_id": venue_id, "busy_slots": list(slots)})