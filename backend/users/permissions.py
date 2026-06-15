from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Доступ только для пользователей с ролью Администратор."""

    message = "Доступ разрешён только администраторам."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )
