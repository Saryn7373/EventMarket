from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.request import Request
from rest_framework.views import APIView


class IsEventOwner(BasePermission):
    """
    Проверка: пользователь — арендатор (Renter) и является создателем мероприятия
    """
    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        if not hasattr(request.user, 'renter'):
            return False
        return obj.renter == request.user.renter


class IsRenter(BasePermission):
    """
    Проверка: пользователь имеет роль Renter
    """
    def has_permission(self, request: Request, view: APIView) -> bool:
        return hasattr(request.user, 'renter')
