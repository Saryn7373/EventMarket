from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from events.models import Event
from users.models import BaseUser, Owner, Renter
from venues.models import Venue

from .models import Booking


class BookingTests(APITestCase):
    def setUp(self):
        owner_user = BaseUser.objects.create_user(
            email="owner@example.com", password="pass12345",
            first_name="Олег", last_name="Владельцев",
        )
        self.owner = Owner.objects.create(user=owner_user)
        self.venue = Venue.objects.create(
            owner=self.owner, name="Лофт на Покровке",
            address="ул. Покровка, 1", city="Москва",
            capacity_min=10, capacity_max=100,
            price_per_hour=Decimal("1000.00"), status="published",
        )

        self.renter_user = BaseUser.objects.create_user(
            email="renter@example.com", password="pass12345",
            first_name="Рина", last_name="Арендаторова",
        )
        self.renter = Renter.objects.create(user=self.renter_user)
        self.event = Event.objects.create(
            renter=self.renter, title="День рождения",
            date=timezone.now().date() + timedelta(days=5), status="planned",
        )

    def test_booking_requires_required_fields(self):
        """Бронирование нельзя создать без обязательных полей."""
        booking = Booking()
        with self.assertRaises(DjangoValidationError) as ctx:
            booking.full_clean()

        errors = ctx.exception.message_dict
        for field in ("event", "venue", "renter", "start_datetime", "end_datetime"):
            self.assertIn(field, errors)

    def test_duration_hours(self):
        """duration_hours округляет длительность и не опускается ниже 1 часа."""
        start = timezone.now() + timedelta(days=1)

        booking_3h = Booking(
            event=self.event, venue=self.venue, renter=self.renter,
            start_datetime=start, end_datetime=start + timedelta(hours=3),
        )
        self.assertEqual(booking_3h.duration_hours, 3)

        booking_short = Booking(
            event=self.event, venue=self.venue, renter=self.renter,
            start_datetime=start, end_datetime=start + timedelta(minutes=20),
        )
        self.assertEqual(booking_short.duration_hours, 1)

    def test_create_booking_via_api(self):
        """POST /api/bookings/ создаёт бронь со статусом pending и рассчитанной ценой."""
        self.client.force_authenticate(self.renter_user)

        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=4)

        response = self.client.post("/api/bookings/", {
            "venue": str(self.venue.id),
            "event": str(self.event.id),
            "start_datetime": start.isoformat(),
            "end_datetime": end.isoformat(),
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(Decimal(response.data["total_price"]), Decimal("4000.00"))

    def test_filter_bookings_by_status(self):
        """GET /api/bookings/?status=confirmed возвращает только брони с этим статусом."""
        now = timezone.now()
        Booking.objects.create(
            event=self.event, venue=self.venue, renter=self.renter,
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
            status="pending",
        )
        confirmed = Booking.objects.create(
            event=self.event, venue=self.venue, renter=self.renter,
            start_datetime=now + timedelta(days=2),
            end_datetime=now + timedelta(days=2, hours=2),
            status="confirmed",
        )

        self.client.force_authenticate(self.renter_user)
        response = self.client.get("/api/bookings/", {"status": "confirmed"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data]
        self.assertEqual(ids, [str(confirmed.id)])
