from django.db.models import QuerySet
from rest_framework import generics, filters, status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db import transaction

from EventMarket.pagination import StandardPagination
from .models import Hire
from .serializers import (
    HireListSerializer,
    HireDetailSerializer,
    HireCreateSerializer,
    HireUpdateSerializer,
    HireStatusSerializer,
)
from .permissions import IsHireParticipant, CanModifyHire, IsRenter
from .filters import HireFilter
from .validators import validate_status_transition_permissions


class HireListCreateView(generics.ListCreateAPIView):
    """
    Список наймов (GET) и создание нового найма (POST)
    """

    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = HireFilter
    ordering_fields = ["start_datetime", "total_price", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self) -> QuerySet[Hire]:
        """Возвращает наймы текущего пользователя: по своим мероприятиям — для Renter, свои — для Specialist."""
        user = self.request.user
        qs = Hire.objects.select_related("event__renter__user", "specialist__user")

        # Арендатор видит наймы своих мероприятий
        if hasattr(user, "renter"):
            return qs.filter(event__renter=user.renter)

        # Специалист видит свои наймы
        if hasattr(user, "specialist"):
            return qs.filter(specialist=user.specialist)

        # Администраторы видят все наймы
        if user.is_staff:
            return qs

        return qs.none()

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор создания для POST, иначе сериализатор списка."""
        if self.request.method == "POST":
            return HireCreateSerializer
        return HireListSerializer

    def get_permissions(self) -> list[BasePermission]:
        """Создавать найм может только Renter, читать список — любой авторизованный."""
        if self.request.method == "POST":
            return [IsRenter()]
        return [IsAuthenticated()]

    def create(self, request: Request, *args, **kwargs) -> Response:
        """Создаёт найм и возвращает его детальное представление."""
        serializer = HireCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            hire = serializer.save()

        return Response(
            HireDetailSerializer(hire).data,
            status=status.HTTP_201_CREATED,
        )


class HireRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Просмотр (GET), обновление (PATCH) и удаление (DELETE) найма
    """

    http_method_names = ["get", "patch", "delete", "head", "options"]
    queryset = Hire.objects.select_related("event__renter__user", "specialist__user")

    def get_permissions(self) -> list[BasePermission]:
        """Читать может любой участник найма, изменять — только при праве на модификацию."""
        if self.request.method == "GET":
            return [IsHireParticipant()]
        return [IsHireParticipant(), CanModifyHire()]

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор обновления для PATCH, иначе детальный сериализатор."""
        if self.request.method == "PATCH":
            return HireUpdateSerializer
        return HireDetailSerializer

    def patch(self, request: Request, *args, **kwargs) -> Response:
        """Обновляет даты найма и возвращает его детальное представление."""
        hire = self.get_object()
        serializer = HireUpdateSerializer(
            hire, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            Hire.objects.select_for_update().filter(pk=hire.pk)
            updated = serializer.save()

        return Response(HireDetailSerializer(updated).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Отменяет найм (статус cancelled), если он ещё pending; физическое удаление запрещено."""
        hire = self.get_object()
        if hire.status != "pending":
            return Response(
                {"detail": "Нельзя удалить уже подтверждённый найм. Используйте отмену."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hire.status = "cancelled"
        hire.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class HireStatusView(APIView):
    """
    Изменение статуса найма (PATCH)

    Доступные переходы:
    - pending → confirmed, cancelled
    - confirmed → cancelled, completed
    - cancelled → (нет переходов)
    - completed → (нет переходов)
    """

    permission_classes = [IsAuthenticated]

    def get_object(self, pk) -> Hire:
        """Возвращает найм по pk с проверкой прав доступа объекта."""
        hire = get_object_or_404(
            Hire.objects.select_related("event__renter__user", "specialist__user"),
            pk=pk,
        )
        self.check_object_permissions(self.request, hire)
        return hire

    def patch(self, request: Request, pk) -> Response:
        """Меняет статус найма согласно конечному автомату переходов."""
        hire = self.get_object(pk)

        with transaction.atomic():
            # Блокировка найма от конкурентных изменений
            Hire.objects.select_for_update().filter(pk=hire.pk)

            serializer = HireStatusSerializer(
                data=request.data,
                context={"hire": hire, "request": request},
            )
            serializer.is_valid(raise_exception=True)

            # Проверка прав на смену статуса
            validate_status_transition_permissions(hire, serializer.validated_data["status"], request.user)

            updated = serializer.save()

        return Response(HireDetailSerializer(updated).data)


class MyHiresView(generics.ListAPIView):
    """
    Список наймов текущего арендатора (Renter)
    """

    serializer_class = HireListSerializer
    permission_classes = [IsRenter]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = HireFilter
    ordering_fields = ["start_datetime", "total_price", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self) -> QuerySet[Hire]:
        """Возвращает наймы по мероприятиям текущего арендатора."""
        return Hire.objects.filter(
            event__renter=self.request.user.renter
        ).select_related("event__renter__user", "specialist__user")


class SpecialistHiresView(generics.ListAPIView):
    """
    Список наймов текущего специалиста
    """

    serializer_class = HireListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = HireFilter
    ordering_fields = ["start_datetime", "total_price", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self) -> QuerySet[Hire]:
        """Возвращает наймы текущего специалиста, либо все наймы для администратора."""
        user = self.request.user
        if hasattr(user, "specialist"):
            return Hire.objects.filter(
                specialist=user.specialist
            ).select_related("event__renter__user", "specialist__user")

        # Администраторы видят все наймы
        if user.is_staff:
            return Hire.objects.select_related("event__renter__user", "specialist__user")

        return Hire.objects.none()


class SpecialistAvailabilityView(APIView):
    """
    Проверка доступности специалиста в период
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, specialist_id) -> Response:
        """Возвращает занятые интервалы специалиста в заданном диапазоне дат."""
        from django.utils import timezone
        from users.models import Specialist

        specialist = get_object_or_404(Specialist, user_id=specialist_id)

        # Получаем параметры из запроса
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")

        if not from_str or not to_str:
            return Response(
                {"detail": "Необходимы параметры 'from' и 'to' в формате ISO 8601."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from_dt = timezone.datetime.fromisoformat(from_str)
            to_dt = timezone.datetime.fromisoformat(to_str)
        except ValueError:
            return Response(
                {"detail": "Неверный формат даты. Используйте ISO 8601."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Проверяем занятость специалиста
        busy_hires = Hire.objects.filter(
            specialist=specialist,
            status__in=("pending", "confirmed"),
            start_datetime__lt=to_dt,
            end_datetime__gt=from_dt,
        ).order_by("start_datetime")

        busy_slots = [
            {
                "id": hire.id,
                "start_datetime": hire.start_datetime,
                "end_datetime": hire.end_datetime,
                "status": hire.status,
                "event_title": hire.event.title,
            }
            for hire in busy_hires
        ]

        return Response({
            "specialist_id": specialist_id,
            "from": from_str,
            "to": to_str,
            "is_available": len(busy_slots) == 0,
            "busy_slots": busy_slots,
        })
