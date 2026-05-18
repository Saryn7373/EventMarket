from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import BaseUser, Renter, Owner, Specialist, UserImage


# ────────────────────────────────────────────────
# JWT: кастомный payload (добавляем email и роль)
# ────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role']  = user.role
        return token


# ────────────────────────────────────────────────
# Регистрация
# ────────────────────────────────────────────────

ROLE_CHOICES = ('renter', 'owner', 'specialist')

class RegisterSerializer(serializers.Serializer):
    email      = serializers.EmailField()
    password   = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=20)
    last_name  = serializers.CharField(max_length=20)
    role       = serializers.ChoiceField(choices=ROLE_CHOICES)

    def validate_email(self, value):
        if BaseUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        role = validated_data.pop('role')
        user = BaseUser.objects.create_user(**validated_data)

        if role == 'renter':
            Renter.objects.create(user=user)
        elif role == 'owner':
            Owner.objects.create(user=user)
        elif role == 'specialist':
            Specialist.objects.create(user=user)

        return user


# ────────────────────────────────────────────────
# Профиль (текущий пользователь)
# ────────────────────────────────────────────────

class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model  = BaseUser
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'role_display', 'date_joined', 'avatar']
        read_only_fields = ['id', 'email', 'role', 'role_display', 'date_joined', 'avatar']

    def get_role(self, obj):
        if obj.is_superuser or obj.is_staff:
            return 'admin'
        if obj.is_renter:
            return 'renter'
        if obj.is_owner:
            return 'owner'
        if obj.is_specialist:
            return 'specialist'
        return 'unknown'

    def get_role_display(self, obj):
        labels = {
            'renter':     'Арендатор',
            'owner':      'Владелец',
            'specialist': 'Специалист',
            'admin':      'Администратор',
            'unknown':    'Без роли',
        }
        return labels[self.get_role(obj)]

    def get_avatar(self, obj):
        try:
            return obj.avatar.image.url  # относительный /media/... — проксируется Nuxt
        except Exception:
            return None

    def update(self, instance, validated_data):
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        request = self.context.get('request')
        if request and 'avatar' in request.FILES:
            UserImage.objects.update_or_create(
                user=instance,
                defaults={'image': request.FILES['avatar']},
            )

        return instance


# ────────────────────────────────────────────────
# Смена пароля
# ────────────────────────────────────────────────

class SpecialistDetailSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='user.id', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Specialist
        fields = [
            'id', 'first_name', 'last_name',
            'specialty', 'license_number', 'city',
            'rating', 'portfolio_url', 'avatar',
        ]

    def get_avatar(self, obj):
        try:
            request = self.context.get('request')
            url = obj.user.avatar.image.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None


class SpecialistListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='user.id', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Specialist
        fields = ['id', 'first_name', 'last_name', 'specialty', 'city', 'rating', 'portfolio_url', 'avatar']

    def get_avatar(self, obj):
        try:
            request = self.context.get('request')
            url = obj.user.avatar.image.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Неверный текущий пароль.")
        return value

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user