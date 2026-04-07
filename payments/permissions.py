from rest_framework.permissions import BasePermission


class IsPaymentOwner(BasePermission):
    """
    Проверка: пользователь является плательщиком (payer) этого платежа
    или является администратором (is_staff).
    """

    def has_object_permission(self, request, view, obj):
        # Администраторы могут видеть все платежи
        if request.user.is_staff:
            return True

        # Плательщик может видеть свои платежи
        return obj.payer.user == request.user


class IsRenter(BasePermission):
    """
    Проверка: пользователь имеет роль Renter
    """

    def has_permission(self, request, view):
        return hasattr(request.user, "renter")
