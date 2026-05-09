from rest_framework import generics, filters, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend

from EventMarket.pagination import StandardPagination
from .filters import SpecialistFilter
from .models import Specialist
from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    MeSerializer,
    ChangePasswordSerializer,
    SpecialistListSerializer,
    SpecialistDetailSerializer,
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

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
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