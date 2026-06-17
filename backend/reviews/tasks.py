from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def notify_admins_new_review(review_type: str, reviewer_email: str, subject_name: str, rating: int) -> None:
    """Отправляет всем администраторам письмо о новом отзыве, ожидающем модерации."""
    from users.models import Admin

    admin_emails = list(
        Admin.objects.select_related('user').values_list('user__email', flat=True)
    )
    if not admin_emails:
        return

    type_label = 'площадке' if review_type == 'venue' else 'специалисте'

    send_mail(
        subject='[EventMarket] Новый отзыв на модерацию',
        message=(
            f'Поступил новый отзыв, требующий модерации.\n\n'
            f'Тип: отзыв о {type_label}\n'
            f'Объект: {subject_name}\n'
            f'Автор: {reviewer_email}\n'
            f'Оценка: {rating}/5\n\n'
            f'Перейдите в панель администратора для проверки отзыва.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=admin_emails,
        fail_silently=False,
    )
