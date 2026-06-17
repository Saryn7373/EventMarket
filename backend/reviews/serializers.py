from rest_framework import serializers

from .models import SpecialistReview, VenueReview
from .validators import validate_can_review_specialist, validate_can_review_venue


# ─────────────────────────────────────────────────────────────
# Вспомогательные вложенные сериализаторы (только для чтения)
# ─────────────────────────────────────────────────────────────

class _RenterShortSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="user.id")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    avatar = serializers.SerializerMethodField()

    def get_avatar(self, obj) -> str | None:
        """Возвращает абсолютный URL аватара арендатора или None, если его нет."""
        try:
            request = self.context.get("request")
            url = obj.user.avatar.image.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None


# ─────────────────────────────────────────────────────────────
# Отзывы о площадках
# ─────────────────────────────────────────────────────────────

class VenueReviewSerializer(serializers.ModelSerializer):
    """Только для чтения — список/детали отзыва."""

    renter = _RenterShortSerializer(read_only=True)

    class Meta:
        model = VenueReview
        fields = ["id", "renter", "rating", "comment", "status", "created_at", "updated_at"]
        read_only_fields = fields


class VenueReviewCreateSerializer(serializers.ModelSerializer):
    """
    Создание/обновление отзыва о площадке.

    Один арендатор — один отзыв на площадку (повторная отправка
    обновляет существующий отзыв).
    """

    class Meta:
        model = VenueReview
        fields = ["rating", "comment"]

    def validate(self, data: dict) -> dict:
        """Проверяет, что арендатор имеет право оставить отзыв об этой площадке."""
        renter = self.context["request"].user.renter
        venue = self.context["venue"]
        validate_can_review_venue(renter, venue)
        return data

    def create(self, validated_data: dict) -> VenueReview:
        """Создаёт отзыв или обновляет существующий (один отзыв на площадку от арендатора)."""
        renter = self.context["request"].user.renter
        venue = self.context["venue"]
        # Новый/изменённый отзыв снова уходит на проверку администратору.
        validated_data["status"] = "pending"
        review, _created = VenueReview.objects.update_or_create(
            venue=venue, renter=renter, defaults=validated_data,
        )
        return review


# ─────────────────────────────────────────────────────────────
# Отзывы о специалистах
# ─────────────────────────────────────────────────────────────

class SpecialistReviewSerializer(serializers.ModelSerializer):
    """Только для чтения — список/детали отзыва."""

    renter = _RenterShortSerializer(read_only=True)

    class Meta:
        model = SpecialistReview
        fields = ["id", "renter", "rating", "comment", "status", "created_at", "updated_at"]
        read_only_fields = fields


class SpecialistReviewCreateSerializer(serializers.ModelSerializer):
    """
    Создание/обновление отзыва о специалисте.

    Один арендатор — один отзыв на специалиста (повторная отправка
    обновляет существующий отзыв).
    """

    class Meta:
        model = SpecialistReview
        fields = ["rating", "comment"]

    def validate(self, data: dict) -> dict:
        """Проверяет, что арендатор имеет право оставить отзыв об этом специалисте."""
        renter = self.context["request"].user.renter
        specialist = self.context["specialist"]
        validate_can_review_specialist(renter, specialist)
        return data

    def create(self, validated_data: dict) -> SpecialistReview:
        """Создаёт отзыв или обновляет существующий (один отзыв на специалиста от арендатора)."""
        renter = self.context["request"].user.renter
        specialist = self.context["specialist"]
        # Новый/изменённый отзыв снова уходит на проверку администратору.
        validated_data["status"] = "pending"
        review, _created = SpecialistReview.objects.update_or_create(
            specialist=specialist, renter=renter, defaults=validated_data,
        )
        return review


# ─────────────────────────────────────────────────────────────
# Модерация отзывов (администратор)
# ─────────────────────────────────────────────────────────────

class AdminReviewSerializer(serializers.Serializer):
    """
    Единое представление отзыва для модерации.

    Подходит и для отзывов о площадках, и о специалистах — поле `type`
    различает их, `target` содержит человекочитаемое название объекта.
    """

    id = serializers.UUIDField(read_only=True)
    type = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    rating = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_type(self, obj) -> str:
        """Определяет тип отзыва по классу модели."""
        return "venue" if isinstance(obj, VenueReview) else "specialist"

    def get_target(self, obj) -> str:
        """Возвращает человекочитаемое название объекта отзыва — площадки или специалиста."""
        if isinstance(obj, VenueReview):
            return obj.venue.name
        name = f"{obj.specialist.user.first_name} {obj.specialist.user.last_name}".strip()
        return name or obj.specialist.user.email

    def get_target_id(self, obj) -> str:
        """Возвращает id площадки или специалиста, к которому относится отзыв."""
        if isinstance(obj, VenueReview):
            return str(obj.venue_id)
        return str(obj.specialist_id)

    def get_author(self, obj) -> str:
        """Возвращает имя автора отзыва или email, если имя не указано."""
        name = f"{obj.renter.user.first_name} {obj.renter.user.last_name}".strip()
        return name or obj.renter.user.email


class ModerateReviewSerializer(serializers.Serializer):
    """Принимает решение модерации: approve / reject."""

    action = serializers.ChoiceField(choices=["approve", "reject"])
