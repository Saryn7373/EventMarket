from rest_framework.permissions import BasePermission


class IsRenter(BasePermission):
    """Оставлять отзывы могут только пользователи с ролью Renter."""

    message = "Оставлять отзывы могут только арендаторы."

    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, "renter")
