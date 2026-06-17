from django.db.models import QuerySet
from rest_framework import generics, filters, status
from rest_framework.permissions import BasePermission, IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from EventMarket.pagination import StandardPagination
from .models import Event
from .serializers import (
    EventListSerializer,
    EventDetailSerializer,
    EventWriteSerializer,
    EventStatusSerializer,
)
from .permissions import IsEventOwner, IsRenter
from .filters import EventFilter


class EventListCreateView(generics.ListCreateAPIView):
    """
    Список всех мероприятий (GET) и создание нового (POST)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = EventFilter
    search_fields = ['title', 'short_description', 'description']
    ordering_fields = ['date', 'expected_guests', 'created_at', 'updated_at']
    ordering = ['-created_at']

    def get_queryset(self) -> QuerySet[Event]:
        """Арендатор видит все мероприятия, остальные — только публично видимые статусы"""
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'renter'):
            return Event.objects.select_related('renter__user').prefetch_related('venues', 'specialists')
        return Event.objects.filter(status__in=['planned', 'active', 'ongoing']).select_related('renter__user')

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор записи для POST, иначе сериализатор списка"""
        if self.request.method == 'POST':
            return EventWriteSerializer
        return EventListSerializer

    def get_permissions(self) -> list[BasePermission]:
        """Создавать мероприятие может только Renter, читать список — любой"""
        if self.request.method == 'POST':
            return [IsRenter()]
        return [IsAuthenticatedOrReadOnly()]

    def create(self, request: Request, *args, **kwargs) -> Response:
        """Создаёт мероприятие и возвращает его детальное представление"""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        return Response(
            EventDetailSerializer(event).data,
            status=status.HTTP_201_CREATED
        )


class EventRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Просмотр (GET), обновление (PUT/PATCH) и удаление (DELETE) мероприятия
    """
    permission_classes = [IsAuthenticatedOrReadOnly, IsEventOwner]

    def get_queryset(self) -> QuerySet[Event]:
        """Возвращает мероприятия с предзагруженными связанными площадками и специалистами"""
        return Event.objects.select_related('renter__user').prefetch_related('venues', 'specialists')

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор записи для PUT/PATCH, иначе детальный сериализатор"""
        if self.request.method in ('PUT', 'PATCH'):
            return EventWriteSerializer
        return EventDetailSerializer

    def retrieve(self, request: Request, *args, **kwargs) -> Response:
        """Возвращает мероприятие, предварительно авто-завершая его, если оно уже прошло"""
        from django.utils import timezone
        from datetime import datetime, time as dt_time

        instance = self.get_object()

        # Авто-завершение: если мероприятие прошло и оно не черновик / не отменено
        if instance.status not in ('draft', 'cancelled', 'completed'):
            end_time = instance.end_time or dt_time(23, 59, 59)
            naive_end = datetime.combine(instance.date, end_time)
            aware_end = timezone.make_aware(naive_end)
            if aware_end < timezone.now():
                instance.status = 'completed'
                instance.save(update_fields=['status', 'updated_at'])

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request: Request, *args, **kwargs) -> Response:
        """Обновляет мероприятие и возвращает его детальное представление"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        return Response(EventDetailSerializer(event).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Запрещает удаление мероприятия с активными бронированиями, иначе помечает его отменённым"""
        event = self.get_object()
        has_active_bookings = event.bookings.filter(
            status__in=['pending', 'confirmed']
        ).exists()
        if has_active_bookings:
            return Response(
                {"detail": "Нельзя удалить мероприятие с активными бронированиями."},
                status=status.HTTP_400_BAD_REQUEST
            )
        event.status = 'cancelled'
        event.save(update_fields=['status', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyEventsView(generics.ListAPIView):
    """
    Список мероприятий текущего арендатора (Renter)
    """
    serializer_class = EventListSerializer
    permission_classes = [IsRenter]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = EventFilter
    ordering_fields = ['date', 'expected_guests', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self) -> QuerySet[Event]:
        """Возвращает мероприятия текущего арендатора"""
        return Event.objects.filter(
            renter=self.request.user.renter
        ).select_related('renter__user').prefetch_related('venues', 'specialists')


class EventStatusView(APIView):
    """
    Изменение статуса мероприятия
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk) -> Event:
        """Возвращает мероприятие по pk с проверкой прав доступа объекта"""
        from django.shortcuts import get_object_or_404
        event = get_object_or_404(
            Event.objects.select_related('renter__user'),
            pk=pk
        )
        self.check_object_permissions(self.request, event)
        return event

    def patch(self, request: Request, pk) -> Response:
        """Меняет статус мероприятия согласно конечному автомату переходов"""
        event = self.get_object(pk)
        serializer = EventStatusSerializer(
            data=request.data,
            context={'event': event, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(EventDetailSerializer(updated).data)
