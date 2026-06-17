from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils.translation import gettext_lazy as _
import uuid

class BaseUserManager(BaseUserManager):
    def create_user(self, email: str, password: str | None = None, **extra_fields) -> "BaseUser":
        """Создаёт пользователя с нормализованным email и хэшированным паролем."""
        if not email:
            raise ValueError(_("Email обязателен"))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra_fields) -> "BaseUser":
        """Создаёт суперпользователя, принудительно выставляя is_staff и is_superuser."""
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
    first_name = models.CharField(_("имя"), max_length=20)
    last_name = models.CharField(_("фамилия"), max_length=20)
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
    def is_renter(self) -> bool:
        return hasattr(self, 'renter')

    @property
    def is_owner(self) -> bool:
        return hasattr(self, 'owner')

    @property
    def is_specialist(self) -> bool:
        return hasattr(self, 'specialist')

    @property
    def is_admin(self) -> bool:
        # Администратором считается пользователь с профилем Admin
        # либо суперпользователь Django.
        return hasattr(self, 'admin') or self.is_superuser

    @property
    def role(self) -> str:
        """Возвращает человекочитаемое название роли пользователя для отображения."""
        if self.is_admin:      return "Администратор"
        if self.is_renter:     return "Арендатор"
        if self.is_owner:      return "Владелец"
        if self.is_specialist: return "Специалист"
        return "Без роли"

class UserImage(models.Model):
    """
    Аватар пользователя — один на пользователя.
    Сделано по образцу VenueImage.
    """
    user = models.OneToOneField(
        BaseUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='avatar',
        verbose_name=_("пользователь"),
    )
    image = models.ImageField(_("фото"), upload_to='users/%Y/%m/')
    created_at = models.DateTimeField(_("создано"), auto_now_add=True)
    updated_at = models.DateTimeField(_("обновлено"), auto_now=True)

    class Meta:
        verbose_name = _("аватар пользователя")
        verbose_name_plural = _("аватары пользователей")

    def __str__(self):
        return f"Аватар: {self.user.email}"

# ROLES

class Admin(models.Model):
    """
    Профиль Администратора платформы.

    Выдаётся только другим администратором (см. users.views.GrantAdminView).
    Даёт доступ к модерации отзывов, управлению пользователями и аналитике.
    """
    user = models.OneToOneField(
        BaseUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="admin",
        verbose_name="пользователь"
    )
    granted_at = models.DateTimeField(_("назначен"), auto_now_add=True)
    granted_by = models.ForeignKey(
        BaseUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_admins",
        verbose_name=_("кем назначен"),
    )

    class Meta:
        verbose_name = _("администратор")
        verbose_name_plural = _("администраторы")

    def __str__(self):
        return f"Администратор: {self.user.email}"


class Renter(models.Model):
    """
    Профиль Арендатора
    """
    user = models.OneToOneField(
        BaseUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="renter",
        verbose_name="пользователь"
    )
    

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
    portfolio_url = models.URLField(_("ссылка на портфолио"), blank=True)   

    class Meta:
        verbose_name = _("специалист")
        verbose_name_plural = _("специалисты")

    def __str__(self):
        name = f"{self.user.first_name} {self.user.last_name}".strip()
        return f"Специалист: {name or self.user.email}"