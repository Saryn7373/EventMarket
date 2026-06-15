from django.db.models import Avg
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import SpecialistReview


@receiver([post_save, post_delete], sender=SpecialistReview)
def update_specialist_rating(sender, instance, **kwargs):
    """Пересчитывает средний рейтинг специалиста по опубликованным отзывам."""
    specialist = instance.specialist
    avg = specialist.reviews.filter(status='approved').aggregate(avg=Avg('rating'))['avg']
    specialist.rating = round(avg, 2) if avg is not None else 0
    specialist.save(update_fields=['rating'])
