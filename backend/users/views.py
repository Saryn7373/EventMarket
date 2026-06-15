from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, filters, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend

from EventMarket.pagination import StandardPagination
from .filters import SpecialistFilter
from .models import Admin, BaseUser, Owner, Specialist, Renter
from .permissions import IsAdmin
from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    MeSerializer,
    ChangePasswordSerializer,
    SpecialistListSerializer,
    SpecialistDetailSerializer,
    AdminUserSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ — получить access + refresh токены"""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(APIView):
    """POST /api/auth/register/ — регистрация нового пользователя"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Сразу выдаём токены после регистрации
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": MeSerializer(user).data,
                "refresh": str(refresh),
                "access":  str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """POST /api/auth/logout/ — занести refresh-токен в чёрный список"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Выход выполнен успешно."}, status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response({"detail": "Неверный или уже отозванный токен."}, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    """GET/PATCH /api/auth/me/ — профиль текущего пользователя"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = MeSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/ — смена пароля"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Пароль успешно изменён."})


class TopOrganizersView(APIView):
    """GET /api/auth/top-organizers/ — топ-3 арендатора по числу проведённых мероприятий"""
    permission_classes = [AllowAny]

    def get(self, request):
        top = (
            Renter.objects
            .annotate(completed_count=Count('events', filter=Q(events__status='completed')))
            .filter(completed_count__gt=0)
            .order_by('-completed_count')
            .select_related('user', 'user__avatar')
            [:3]
        )
        result = []
        for renter in top:
            avatar_url = None
            try:
                avatar_url = renter.user.avatar.image.url
            except Exception:
                pass
            result.append({
                'id': str(renter.user.id),
                'first_name': renter.user.first_name,
                'last_name': renter.user.last_name,
                'avatar': avatar_url,
                'completed_events': renter.completed_count,
            })
        return Response(result)


class SpecialistListView(generics.ListAPIView):
    """GET /api/specialists/ — публичный список специалистов"""
    serializer_class = SpecialistListSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SpecialistFilter
    search_fields = ['user__first_name', 'user__last_name', 'specialty', 'city']
    ordering_fields = ['rating', 'user__first_name', 'user__last_name']
    ordering = ['-rating']

    def get_queryset(self):
        return Specialist.objects.select_related('user', 'user__avatar').all()


class SpecialistDetailView(generics.RetrieveAPIView):
    """GET /api/specialists/<uuid:pk>/ — публичная детальная страница специалиста"""
    serializer_class = SpecialistDetailSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        return generics.get_object_or_404(
            Specialist.objects.select_related('user', 'user__avatar'),
            user__id=self.kwargs['pk'],
        )


# ────────────────────────────────────────────────
# Администрирование: управление пользователями
# ────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    """GET /api/auth/admin/users/ — список всех пользователей (только админ)"""
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['date_joined', 'email']
    ordering = ['-date_joined']

    def get_queryset(self):
        return BaseUser.objects.select_related(
            'admin', 'renter', 'owner', 'specialist',
        ).all()


class AdminUserDetailView(APIView):
    """DELETE /api/auth/admin/users/<uuid:pk>/ — удалить пользователя (только админ)"""
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        if str(request.user.id) == str(pk):
            return Response(
                {"detail": "Нельзя удалить собственную учётную запись."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target = get_object_or_404(BaseUser, pk=pk)
        if target.is_superuser:
            return Response(
                {"detail": "Нельзя удалить суперпользователя."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GrantAdminView(APIView):
    """POST /api/auth/admin/users/<uuid:pk>/grant-admin/ — выдать права администратора

    Выдать роль администратора может только администратор.
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        target = get_object_or_404(BaseUser, pk=pk)
        if target.is_admin:
            return Response(
                {"detail": "Пользователь уже является администратором."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        Admin.objects.create(user=target, granted_by=request.user)
        # Даём доступ в Django-админку
        if not target.is_staff:
            target.is_staff = True
            target.save(update_fields=['is_staff'])
        return Response(
            AdminUserSerializer(target).data,
            status=status.HTTP_200_OK,
        )


class AdminAnalyticsView(APIView):
    """GET /api/auth/admin/analytics/ — аналитика популярности (только админ)

    Популярность площадок и специалистов рассчитывается по количеству
    завершённых бронирований / наймов.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        from venues.models import Venue

        limit = int(request.query_params.get('limit', 10))

        top_venues = (
            Venue.objects
            .annotate(completed_count=Count(
                'bookings', filter=Q(bookings__status='completed'),
            ))
            .filter(completed_count__gt=0)
            .order_by('-completed_count')
            .select_related('owner__user')[:limit]
        )
        venues_data = [{
            'id': str(v.id),
            'name': v.name,
            'city': v.city,
            'slug': v.slug,
            'completed_bookings': v.completed_count,
        } for v in top_venues]

        top_specialists = (
            Specialist.objects
            .annotate(completed_count=Count(
                'hires', filter=Q(hires__status='completed'),
            ))
            .filter(completed_count__gt=0)
            .order_by('-completed_count')
            .select_related('user')[:limit]
        )
        specialists_data = [{
            'id': str(s.user.id),
            'first_name': s.user.first_name,
            'last_name': s.user.last_name,
            'specialty': s.specialty,
            'city': s.city,
            'completed_hires': s.completed_count,
        } for s in top_specialists]

        return Response({
            'top_venues': venues_data,
            'top_specialists': specialists_data,
        })