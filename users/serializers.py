from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import BaseUser, Renter, Owner, Specialist


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
    role = serializers.CharField(read_only=True)

    class Meta:
        model  = BaseUser
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'date_joined']
        read_only_fields = ['id', 'email', 'role', 'date_joined']


# ────────────────────────────────────────────────
# Смена пароля
# ────────────────────────────────────────────────

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