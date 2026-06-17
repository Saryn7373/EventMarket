from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.request import Request
from rest_framework.views import APIView


class IsRenter(BasePermission):
    """Только пользователи с ролью Renter."""

    message = "Доступ разрешён только арендаторам."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and hasattr(request.user, "renter")


class IsOwnerUser(BasePermission):
    """Только пользователи с ролью Owner."""

    message = "Доступ разрешён только владельцам площадок."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and hasattr(request.user, "owner")


class IsBookingParticipant(BasePermission):
    """
    Детали брони видят только:
    - арендатор, создавший бронь
    - владелец площадки из этой брони
    """

    message = "У вас нет доступа к этому бронированию."

    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        user = request.user
        is_renter = hasattr(user, "renter") and obj.renter == user.renter
        is_venue_owner = hasattr(user, "owner") and obj.venue.owner == user.owner
        return is_renter or is_venue_owner


class CanModifyBooking(BasePermission):
    """
    Изменять (PATCH кроме статуса) бронь может только
    арендатор, пока она в статусе pending.
    """

    message = "Изменить бронирование нельзя — оно уже подтверждено или завершено."

    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        is_renter = hasattr(user, "renter") and obj.renter == user.renter
        return is_renter and obj.status == "pending"