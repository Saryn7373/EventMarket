from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class IsRenter(BasePermission):
    """Оставлять отзывы могут только пользователи с ролью Renter."""

    message = "Оставлять отзывы могут только арендаторы."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and hasattr(request.user, "renter")
