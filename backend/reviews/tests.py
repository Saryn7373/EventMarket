from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from bookings.models import Booking
from events.models import Event
from hires.models import Hire
from users.models import Admin, BaseUser, Owner, Renter, Specialist
from venues.models import Venue


class ReviewModerationTests(APITestCase):
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

        specialist_user = BaseUser.objects.create_user(
            email="specialist@example.com", password="pass12345",
            first_name="Семён", last_name="Специалистов",
        )
        self.specialist = Specialist.objects.create(user=specialist_user, specialty="Фотограф")

        self.renter_user = BaseUser.objects.create_user(
            email="renter@example.com", password="pass12345",
            first_name="Рина", last_name="Арендаторова",
        )
        self.renter = Renter.objects.create(user=self.renter_user)
        self.event = Event.objects.create(
            renter=self.renter, title="День рождения",
            date=timezone.now().date() + timedelta(days=10), status="completed",
        )

        self.admin_user = BaseUser.objects.create_user(
            email="admin@example.com", password="pass12345",
            first_name="Админ", last_name="Админов",
        )
        Admin.objects.create(user=self.admin_user)

    def test_new_venue_review_is_pending_and_hidden(self):
        """Новый отзыв уходит на модерацию и не виден в публичном списке."""
        now = timezone.now()
        Booking.objects.create(
            event=self.event, venue=self.venue, renter=self.renter,
            start_datetime=now - timedelta(days=5),
            end_datetime=now - timedelta(days=5) + timedelta(hours=2),
            status="completed",
        )

        self.client.force_authenticate(self.renter_user)
        response = self.client.post(f"/api/reviews/venues/{self.venue.id}/", {
            "rating": 5, "comment": "Отличное место!",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "pending")

        self.client.force_authenticate(None)
        list_response = self.client.get(f"/api/reviews/venues/{self.venue.id}/")
        self.assertEqual(list_response.data["count"], 0)

    def test_admin_moderates_specialist_review(self):
        """Только администратор модерирует отзывы; одобрение публикует отзыв и пересчитывает рейтинг."""
        now = timezone.now()
        Hire.objects.create(
            event=self.event, specialist=self.specialist,
            start_datetime=now - timedelta(days=5),
            end_datetime=now - timedelta(days=5) + timedelta(hours=2),
            status="completed",
        )

        self.client.force_authenticate(self.renter_user)
        create_response = self.client.post(
            f"/api/reviews/specialists/{self.specialist.user_id}/",
            {"rating": 4, "comment": "Хороший специалист"},
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        review_id = create_response.data["id"]

        # Обычный пользователь не имеет доступа к модерации
        forbidden = self.client.get("/api/reviews/admin/")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Администратор видит отзыв на проверке
        self.client.force_authenticate(self.admin_user)
        pending_list = self.client.get("/api/reviews/admin/")
        self.assertEqual(pending_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(pending_list.data), 1)
        self.assertEqual(pending_list.data[0]["id"], review_id)

        moderate = self.client.post(
            f"/api/reviews/admin/specialists/{review_id}/moderate/",
            {"action": "approve"},
        )
        self.assertEqual(moderate.status_code, status.HTTP_200_OK)
        self.assertEqual(moderate.data["status"], "approved")

        self.specialist.refresh_from_db()
        self.assertEqual(self.specialist.rating, Decimal("4.00"))

        self.client.force_authenticate(None)
        public_list = self.client.get(f"/api/reviews/specialists/{self.specialist.user_id}/")
        self.assertEqual(public_list.data["count"], 1)
