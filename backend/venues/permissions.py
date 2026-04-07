from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerUser(BasePermission):
    """Доступ только для пользователей с ролью Owner"""
    message = "Доступ разрешён только владельцам площадок."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            hasattr(request.user, 'owner')
        )


class IsVenueOwner(BasePermission):
    """Изменять/удалять площадку может только её владелец"""
    message = "Вы не являетесь владельцем этой площадки."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.owner == request.user.owner