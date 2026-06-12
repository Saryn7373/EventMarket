from celery import shared_task
from django.utils import timezone
from bookings.models import Booking
from hires.models import Hire


@shared_task
def update_expired_statuses():
    now = timezone.now()

    bookings_completed = Booking.objects.filter(
        status='confirmed', end_datetime__lt=now
    ).update(status='completed')

    bookings_cancelled = Booking.objects.filter(
        status='pending', end_datetime__lt=now
    ).update(status='cancelled')

    hires_completed = Hire.objects.filter(
        status='confirmed', end_datetime__lt=now
    ).update(status='completed')

    hires_cancelled = Hire.objects.filter(
        status='pending', end_datetime__lt=now
    ).update(status='cancelled')

    return {
        'bookings_completed': bookings_completed,
        'bookings_cancelled': bookings_cancelled,
        'hires_completed': hires_completed,
        'hires_cancelled': hires_cancelled,
    }
