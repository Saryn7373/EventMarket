from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils.translation import gettext_lazy as _
import uuid

class BaseUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_("Email обязателен"))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_("Superuser должен иметь is_staff=True"))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_("Superuser должен иметь is_superuser=True"))

        return self.create_user(email, password, **extra_fields)


class BaseUser(AbstractBaseUser, PermissionsMixin):
    """
    Базовая модель пользователя (без username, логин по email)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_("email адрес"), unique=True, db_index=True)
    is_active = models.BooleanField(_("активен"), default=True)
    is_staff = models.BooleanField(_("доступ в админку"), default=False)
    date_joined = models.DateTimeField(_("дата регистрации"), auto_now_add=True)

    objects = BaseUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _("пользователь")
        verbose_name_plural = _("пользователи")
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    # Удобные свойства для проверки ролей
    @property
    def is_renter(self):
        return hasattr(self, 'renter')

    @property
    def is_owner(self):
        return hasattr(self, 'owner')

    @property
    def is_specialist(self):
        return hasattr(self, 'specialist')

    @property
    def role(self):
        if self.is_renter:     return "Арендатор"
        if self.is_owner:      return "Владелец"
        if self.is_specialist: return "Специалист"
        return "Без роли"

class Renter(models.Model):
    """
    Профиль Арендатора
    """
    user = models.OneToOneField(
        BaseUser,
        on_delete=models.CASCADE,
        primary_key=True,           # можно сделать pk=True, тогда не будет лишнего id
        related_name="renter",
        verbose_name="пользователь"
    )
    # Примеры полей, специфичных для арендатора
    

    class Meta:
        verbose_name = _("арендатор")
        verbose_name_plural = _("арендаторы")

    def __str__(self):
        return f"Арендатор: {self.user.email}"

class Owner(models.Model):
    user = models.OneToOneField(
        BaseUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="owner",
        verbose_name="пользователь"
    )
    
    inn = models.CharField(_("ИНН / ЕГРН"), max_length=20, blank=True)
    verified = models.BooleanField(_("проверен"), default=False)
    rating = models.DecimalField(_("рейтинг"), max_digits=3, decimal_places=2, default=0.00)
    class Meta:
        verbose_name = _("владелец")
        verbose_name_plural = _("владельцы")

    def __str__(self):
        return f"Владелец: {self.user.email}"

class Specialist(models.Model):
    """
    Профиль Специалиста (риелтор, юрист, ремонтник и т.д.)
    """
    user = models.OneToOneField(
        BaseUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="specialist",
        verbose_name="пользователь"
    )
    # Примеры полей
    specialty = models.CharField(_("специализация"), max_length=150, blank=True)
    license_number = models.CharField(_("номер лицензии"), max_length=50, blank=True)
    city = models.CharField(_("город работы"), max_length=100, blank=True)
    rating = models.DecimalField(_("рейтинг"), max_digits=3, decimal_places=2, default=0.00)    

    class Meta:
        verbose_name = _("специалист")
        verbose_name_plural = _("специалисты")

    def __str__(self):
        return f"Специалист: {self.user.full_name}"