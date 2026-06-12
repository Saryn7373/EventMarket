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

    def get_avatar(self, obj):
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
        fields = ["id", "renter", "rating", "comment", "created_at", "updated_at"]
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

    def validate(self, data):
        renter = self.context["request"].user.renter
        venue = self.context["venue"]
        validate_can_review_venue(renter, venue)
        return data

    def create(self, validated_data):
        renter = self.context["request"].user.renter
        venue = self.context["venue"]
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
        fields = ["id", "renter", "rating", "comment", "created_at", "updated_at"]
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

    def validate(self, data):
        renter = self.context["request"].user.renter
        specialist = self.context["specialist"]
        validate_can_review_specialist(renter, specialist)
        return data

    def create(self, validated_data):
        renter = self.context["request"].user.renter
        specialist = self.context["specialist"]
        review, _created = SpecialistReview.objects.update_or_create(
            specialist=specialist, renter=renter, defaults=validated_data,
        )
        return review
