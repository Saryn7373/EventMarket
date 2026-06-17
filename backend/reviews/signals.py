from django.db.models import Avg
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import SpecialistReview, VenueReview


@receiver([post_save, post_delete], sender=SpecialistReview)
def update_specialist_rating(sender, instance, **kwargs) -> None:
    """Пересчитывает средний рейтинг специалиста по опубликованным отзывам."""
    specialist = instance.specialist
    avg = specialist.reviews.filter(status='approved').aggregate(avg=Avg('rating'))['avg']
    specialist.rating = round(avg, 2) if avg is not None else 0
    specialist.save(update_fields=['rating'])


@receiver(post_save, sender=VenueReview)
def notify_admin_new_venue_review(sender, instance, created, **kwargs) -> None:
    """Уведомляет администраторов по почте о новом отзыве о площадке, ожидающем модерации."""
    if not created:
        return
    from .tasks import notify_admins_new_review
    notify_admins_new_review.delay(
        review_type='venue',
        reviewer_email=instance.renter.user.email,
        subject_name=instance.venue.name,
        rating=instance.rating,
    )


@receiver(post_save, sender=SpecialistReview)
def notify_admin_new_specialist_review(sender, instance, created, **kwargs) -> None:
    """Уведомляет администраторов по почте о новом отзыве о специалисте, ожидающем модерации."""
    if not created:
        return
    from .tasks import notify_admins_new_review
    specialist = instance.specialist
    name = f"{specialist.user.first_name} {specialist.user.last_name}".strip() or specialist.user.email
    notify_admins_new_review.delay(
        review_type='specialist',
        reviewer_email=instance.renter.user.email,
        subject_name=name,
        rating=instance.rating,
    )
