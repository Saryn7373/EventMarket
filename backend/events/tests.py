from datetime import time, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import BaseUser, Renter

from .models import Event
from .serializers import EventWriteSerializer


class EventTests(APITestCase):
    def setUp(self):
        renter_user = BaseUser.objects.create_user(
            email="renter@example.com", password="pass12345",
            first_name="Рина", last_name="Арендаторова",
        )
        self.renter = Renter.objects.create(user=renter_user)

    def test_event_filter_by_theme_and_date(self):
        """GET /api/events/ корректно фильтрует по теме и диапазону дат."""
        today = timezone.now().date()

        wedding_in_range = Event.objects.create(
            renter=self.renter, title="Свадьба Ани и Бориса",
            date=today + timedelta(days=10), theme="wedding", status="planned",
        )
        Event.objects.create(
            renter=self.renter, title="Корпоратив",
            date=today + timedelta(days=10), theme="corporate", status="planned",
        )
        Event.objects.create(
            renter=self.renter, title="Свадьба за пределами диапазона",
            date=today + timedelta(days=60), theme="wedding", status="planned",
        )

        response = self.client.get("/api/events/", {
            "theme": "wedding",
            "date_from": (today + timedelta(days=1)).isoformat(),
            "date_to": (today + timedelta(days=20)).isoformat(),
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data]
        self.assertEqual(ids, [str(wedding_in_range.id)])

    def test_event_is_upcoming_and_is_today(self):
        """Свойства is_today/is_upcoming корректно определяют близость мероприятия."""
        today_event = Event.objects.create(
            renter=self.renter, title="Сегодня",
            date=timezone.now().date(), start_time=time(23, 59),
        )
        self.assertTrue(today_event.is_today)
        self.assertTrue(today_event.is_upcoming)

        past_event = Event.objects.create(
            renter=self.renter, title="Вчера",
            date=timezone.now().date() - timedelta(days=1),
        )
        self.assertFalse(past_event.is_today)
        self.assertFalse(past_event.is_upcoming)

    def test_event_write_serializer_validation(self):
        """EventWriteSerializer отклоняет некорректное время и число гостей."""
        base = {
            "title": "Тест", "date": (timezone.now().date() + timedelta(days=1)).isoformat(),
            "theme": "other", "expected_guests": 10,
        }

        bad_time = EventWriteSerializer(data={**base, "start_time": "18:00", "end_time": "17:00"})
        self.assertFalse(bad_time.is_valid())
        self.assertIn("end_time", bad_time.errors)

        bad_guests = EventWriteSerializer(data={**base, "expected_guests": 0})
        self.assertFalse(bad_guests.is_valid())
        self.assertIn("expected_guests", bad_guests.errors)
