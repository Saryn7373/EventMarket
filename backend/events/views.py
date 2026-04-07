from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

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

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'renter'):
            return Event.objects.select_related('renter__user').prefetch_related('venues', 'specialists')
        return Event.objects.filter(status__in=['planned', 'active', 'ongoing']).select_related('renter__user')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EventWriteSerializer
        return EventListSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsRenter()]
        return [IsAuthenticatedOrReadOnly()]

    def create(self, request, *args, **kwargs):
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

    def get_queryset(self):
        return Event.objects.select_related('renter__user').prefetch_related('venues', 'specialists')

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return EventWriteSerializer
        return EventDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        return Response(EventDetailSerializer(event).data)

    def destroy(self, request, *args, **kwargs):
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
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = EventFilter
    ordering_fields = ['date', 'expected_guests', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return Event.objects.filter(
            renter=self.request.user.renter
        ).select_related('renter__user').prefetch_related('venues', 'specialists')


class EventStatusView(APIView):
    """
    Изменение статуса мероприятия
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        from django.shortcuts import get_object_or_404
        event = get_object_or_404(
            Event.objects.select_related('renter__user'),
            pk=pk
        )
        self.check_object_permissions(self.request, event)
        return event

    def patch(self, request, pk):
        event = self.get_object(pk)
        serializer = EventStatusSerializer(
            data=request.data,
            context={'event': event, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(EventDetailSerializer(updated).data)
