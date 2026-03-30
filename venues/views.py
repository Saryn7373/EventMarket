from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VenueFilter
    search_fields   = ['name', 'city', 'address', 'short_description']
    ordering_fields = ['price_per_hour', 'price_per_day', 'capacity_max', 'created_at']
    ordering        = ['-created_at']

    def get_queryset(self):
        # Анонимы и арендаторы видят только опубликованные
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'owner'):
            # Владелец видит свои площадки в любом статусе
            return Venue.objects.select_related('owner__user').prefetch_related('images')
        return Venue.objects.filter(status='published').select_related('owner__user').prefetch_related('images')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VenueWriteSerializer
        return VenueListSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOwnerUser()]
        return [IsAuthenticatedOrReadOnly()]

    def create(self, request, *args, **kwargs):
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

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return VenueWriteSerializer
        return VenueDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        venue = serializer.save()
        return Response(VenueDetailSerializer(venue).data)
    
    def destroy(self, request, *args, **kwargs):
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

    def get_queryset(self):
        return Venue.objects.filter(
            owner=self.request.user.owner
        ).select_related('owner__user').prefetch_related('images')


# ────────────────────────────────────────────────
# POST   /api/venues/<id>/images/  — загрузить фото
# DELETE /api/venues/<id>/images/<image_id>/  — удалить фото
# ────────────────────────────────────────────────

class VenueImageUploadView(APIView):
    permission_classes = [IsOwnerUser]

    def post(self, request, pk):
        venue = generics.get_object_or_404(
            Venue, pk=pk, owner=request.user.owner
        )
        serializer = VenueImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(venue=venue)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VenueImageDeleteView(APIView):
    permission_classes = [IsOwnerUser]

    def delete(self, request, pk, image_id):
        image = generics.get_object_or_404(
            VenueImage, pk=image_id, venue__pk=pk, venue__owner=request.user.owner
        )
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)