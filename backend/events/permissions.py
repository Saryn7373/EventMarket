from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsEventOwner(BasePermission):
    """
    Проверка: пользователь — арендатор (Renter) и является создателем мероприятия
    """
    def has_object_permission(self, request, view, obj):
        if not hasattr(request.user, 'renter'):
            return False
        return obj.renter == request.user.renter


class IsRenter(BasePermission):
    """
    Проверка: пользователь имеет роль Renter
    """
    def has_permission(self, request, view):
        return hasattr(request.user, 'renter')
