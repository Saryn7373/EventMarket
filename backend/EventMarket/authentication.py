from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class OptionalJWTAuthentication(JWTAuthentication):
    """
    JWTAuthentication, но недействительный/просроченный токен в заголовке
    Authorization не приводит к 401 на публичных (AllowAny) эндпоинтах —
    запрос считается анонимным, как если бы заголовка не было вовсе.

    Без этого браузер с устаревшим токеном (например, после очистки БД
    или истечения срока действия) не может зайти даже на страницы
    регистрации/логина и другие публичные эндпоинты.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None
