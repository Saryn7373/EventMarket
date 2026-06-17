from django.db.models import QuerySet
from rest_framework import generics, filters, status
from rest_framework.permissions import BasePermission, IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from EventMarket.pagination import StandardPagination
from .models import Venue, VenueImage
from .serializers import (
    VenueListSerializer,
    VenueDetailSerializer,
    VenueWriteSerializer,
    VenueImageSerializer,
)
from .permissions import IsOwnerUser, IsVenueOwner
from .filters import VenueFilter


# ────────────────────────────────────────────────
# GET  /api/venues/         — список всех опубликованных площадок
# POST /api/venues/         — создать площадку (только Owner)
# ────────────────────────────────────────────────

class VenueListCreateView(generics.ListCreateAPIView):
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VenueFilter
    search_fields   = ['name', 'city', 'address', 'short_description']
    ordering_fields = ['price_per_hour', 'price_per_day', 'capacity_max', 'created_at']
    ordering        = ['-created_at']

    def get_queryset(self) -> QuerySet[Venue]:
        """Возвращает все площадки для владельца или только опубликованные для остальных."""
        # Анонимы и арендаторы видят только опубликованные
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'owner'):
            # Владелец видит свои площадки в любом статусе
            return Venue.objects.select_related('owner__user').prefetch_related('images')
        return Venue.objects.filter(status='published').select_related('owner__user').prefetch_related('images')

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор записи для POST, иначе сериализатор списка."""
        if self.request.method == 'POST':
            return VenueWriteSerializer
        return VenueListSerializer

    def get_permissions(self) -> list[BasePermission]:
        """Создавать площадку может только владелец, читать список — любой."""
        if self.request.method == 'POST':
            return [IsOwnerUser()]
        return [IsAuthenticatedOrReadOnly()]

    def create(self, request: Request, *args, **kwargs) -> Response:
        """Создаёт площадку и возвращает её детальное представление."""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        venue = serializer.save()
        return Response(
            VenueDetailSerializer(venue).data,
            status=status.HTTP_201_CREATED
        )


# ────────────────────────────────────────────────
# GET    /api/venues/<id>/   — детали площадки
# PUT    /api/venues/<id>/   — полное обновление (только Owner)
# PATCH  /api/venues/<id>/   — частичное обновление (только Owner)
# DELETE /api/venues/<id>/   — удалить (только Owner)
# ────────────────────────────────────────────────

class VenueRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Venue.objects.select_related('owner__user').prefetch_related('images')
    permission_classes = [IsAuthenticatedOrReadOnly, IsVenueOwner]

    def get_serializer_class(self) -> type:
        """Возвращает сериализатор записи для PUT/PATCH, иначе детальный сериализатор."""
        if self.request.method in ('PUT', 'PATCH'):
            return VenueWriteSerializer
        return VenueDetailSerializer

    def update(self, request: Request, *args, **kwargs) -> Response:
        """Обновляет площадку и возвращает её детальное представление."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        venue = serializer.save()
        return Response(VenueDetailSerializer(venue).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Запрещает удаление площадки при наличии активных бронирований."""
        venue = self.get_object()

        has_active = venue.bookings.filter(
            status__in=['pending', 'confirmed']
        ).exists()

        if has_active:
            total = venue.bookings.count()
            return Response(
                {"detail": f"Нельзя удалить: {total} бронирований."},
                status=400
            )

        return super().destroy(request, *args, **kwargs)


# ────────────────────────────────────────────────
# GET /api/venues/my/  — площадки текущего владельца
# ────────────────────────────────────────────────

class MyVenuesView(generics.ListAPIView):
    serializer_class = VenueListSerializer
    permission_classes = [IsOwnerUser]
    pagination_class = StandardPagination

    def get_queryset(self) -> QuerySet[Venue]:
        """Возвращает площадки текущего владельца."""
        return Venue.objects.filter(
            owner=self.request.user.owner
        ).select_related('owner__user').prefetch_related('images')


# ────────────────────────────────────────────────
# POST   /api/venues/<id>/images/  — загрузить фото
# DELETE /api/venues/<id>/images/<image_id>/  — удалить фото
# ────────────────────────────────────────────────

class VenueImageUploadView(APIView):
    permission_classes = [IsOwnerUser]

    def post(self, request: Request, pk) -> Response:
        """Загружает новое фото для площадки текущего владельца."""
        venue = generics.get_object_or_404(
            Venue, pk=pk, owner=request.user.owner
        )
        serializer = VenueImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(venue=venue)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VenueImageDeleteView(APIView):
    permission_classes = [IsOwnerUser]

    def delete(self, request: Request, pk, image_id) -> Response:
        """Удаляет фото площадки, принадлежащей текущему владельцу."""
        image = generics.get_object_or_404(
            VenueImage, pk=image_id, venue__pk=pk, venue__owner=request.user.owner
        )
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ────────────────────────────────────────────────
# GET /api/venues/slug/<slug>/ — публичная детальная страница по slug
# ────────────────────────────────────────────────

class VenueBySlugView(generics.RetrieveAPIView):
    serializer_class = VenueDetailSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_object(self) -> Venue:
        """Возвращает опубликованную площадку по slug из URL."""
        return generics.get_object_or_404(
            Venue.objects.select_related('owner__user').prefetch_related('images'),
            slug=self.kwargs['slug'],
            status='published',
        )