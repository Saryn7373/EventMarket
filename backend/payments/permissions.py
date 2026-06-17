from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class IsPaymentOwner(BasePermission):
    """
    Проверка: пользователь является плательщиком (payer) этого платежа
    или является администратором (is_staff).
    """

    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        # Администраторы могут видеть все платежи
        if request.user.is_staff:
            return True

        # Плательщик может видеть свои платежи
        return obj.payer.user == request.user


class IsRenter(BasePermission):
    """
    Проверка: пользователь имеет роль Renter
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        return hasattr(request.user, "renter")
