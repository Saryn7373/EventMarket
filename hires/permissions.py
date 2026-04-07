from rest_framework.permissions import BasePermission


class IsHireParticipant(BasePermission):
    """
    Проверка: пользователь является участником найма
    (арендатор мероприятия ИЛИ специалист).
    """

    def has_object_permission(self, request, view, obj):
        is_renter = hasattr(request.user, "renter") and obj.event.renter == request.user.renter
        is_specialist = hasattr(request.user, "specialist") and obj.specialist == request.user.specialist
        is_admin = request.user.is_staff

        return is_renter or is_specialist or is_admin


class CanModifyHire(BasePermission):
    """
    Проверка: пользователь может изменять найм.

    - Renter может изменять свои наймы (пока pending)
    - Specialist может изменять свои наймы (пока pending)
    """

    def has_object_permission(self, request, view, obj):
        is_renter = hasattr(request.user, "renter") and obj.event.renter == request.user.renter
        is_specialist = hasattr(request.user, "specialist") and obj.specialist == request.user.specialist

        # Только пока найм в статусе pending
        if obj.status != "pending":
            return False

        return is_renter or is_specialist


class IsRenter(BasePermission):
    """
    Проверка: пользователь имеет роль Renter
    """

    def has_permission(self, request, view):
        return hasattr(request.user, "renter")


class IsSpecialist(BasePermission):
    """
    Проверка: пользователь имеет роль Specialist
    """

    def has_permission(self, request, view):
        return hasattr(request.user, "specialist")
