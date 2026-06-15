from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    RegisterView,
    LogoutView,
    MeView,
    ChangePasswordView,
    TopOrganizersView,
    AdminUserListView,
    AdminUserDetailView,
    GrantAdminView,
    AdminAnalyticsView,
)

urlpatterns = [
    path('register/',         RegisterView.as_view(),              name='auth-register'),
    path('login/',            CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('logout/',           LogoutView.as_view(),                name='auth-logout'),
    path('token/refresh/',    TokenRefreshView.as_view(),          name='auth-token-refresh'),
    path('me/',               MeView.as_view(),                    name='auth-me'),
    path('change-password/',  ChangePasswordView.as_view(),        name='auth-change-password'),
    path('top-organizers/',   TopOrganizersView.as_view(),         name='auth-top-organizers'),

    # ── Администрирование ──
    path('admin/users/',                       AdminUserListView.as_view(),   name='admin-user-list'),
    path('admin/users/<uuid:pk>/',             AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<uuid:pk>/grant-admin/', GrantAdminView.as_view(),      name='admin-grant-admin'),
    path('admin/analytics/',                   AdminAnalyticsView.as_view(),  name='admin-analytics'),
]
