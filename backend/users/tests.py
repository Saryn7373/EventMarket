from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from bookings.models import Booking
from events.models import Event
from hires.models import Hire
from venues.models import Venue

from .models import Admin, BaseUser, Owner, Renter, Specialist


class GrantAdminTests(APITestCase):
    def setUp(self):
        self.admin_user = BaseUser.objects.create_user(
            email="admin@example.com", password="pass12345",
            first_name="Админ", last_name="Админов",
        )
        Admin.objects.create(user=self.admin_user)

        self.regular_user = BaseUser.objects.create_user(
            email="regular@example.com", password="pass12345",
            first_name="Реня", last_name="Регулярова",
        )
        Renter.objects.create(user=self.regular_user)

        self.target_user = BaseUser.objects.create_user(
            email="target@example.com", password="pass12345",
            first_name="Тарас", last_name="Целевой",
        )
        Renter.objects.create(user=self.target_user)

    def test_only_admin_can_grant_admin_role(self):
        """Выдать права администратора может только администратор."""
        url = f"/api/auth/admin/users/{self.target_user.id}/grant-admin/"

        self.client.force_authenticate(self.regular_user)
        forbidden = self.client.post(url)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin_user)
        granted = self.client.post(url)
        self.assertEqual(granted.status_code, status.HTTP_200_OK, granted.data)
        self.assertTrue(granted.data["is_admin"])

        self.target_user.refresh_from_db()
        self.assertTrue(Admin.objects.filter(user=self.target_user).exists())
        self.assertTrue(self.target_user.is_staff)

        repeat = self.client.post(url)
        self.assertEqual(repeat.status_code, status.HTTP_400_BAD_REQUEST)


class AdminAnalyticsTests(APITestCase):
    def setUp(self):
        self.admin_user = BaseUser.objects.create_user(
            email="admin@example.com", password="pass12345",
            first_name="Админ", last_name="Админов",
        )
        Admin.objects.create(user=self.admin_user)

        owner_user = BaseUser.objects.create_user(
            email="owner@example.com", password="pass12345",
            first_name="Олег", last_name="Владельцев",
        )
        owner = Owner.objects.create(user=owner_user)

        self.popular_venue = Venue.objects.create(
            owner=owner, name="Популярный лофт",
            address="ул. Покровка, 1", city="Москва",
            capacity_min=10, capacity_max=100,
            price_per_hour=Decimal("1000.00"), status="published",
        )
        self.quiet_venue = Venue.objects.create(
            owner=owner, name="Тихий зал",
            address="ул. Тихая, 2", city="Москва",
            capacity_min=10, capacity_max=50,
            price_per_hour=Decimal("500.00"), status="published",
        )

        specialist_user = BaseUser.objects.create_user(
            email="specialist@example.com", password="pass12345",
            first_name="Семён", last_name="Специалистов",
        )
        self.specialist = Specialist.objects.create(user=specialist_user, specialty="Фотограф")

        renter_user = BaseUser.objects.create_user(
            email="renter@example.com", password="pass12345",
            first_name="Рина", last_name="Арендаторова",
        )
        renter = Renter.objects.create(user=renter_user)

        event = Event.objects.create(
            renter=renter, title="Мероприятие",
            date=timezone.now().date() + timedelta(days=10), status="completed",
        )

        now = timezone.now()
        for i in range(2):
            Booking.objects.create(
                event=event, venue=self.popular_venue, renter=renter,
                start_datetime=now - timedelta(days=i + 1),
                end_datetime=now - timedelta(days=i + 1) + timedelta(hours=2),
                status="completed",
            )
        Booking.objects.create(
            event=event, venue=self.quiet_venue, renter=renter,
            start_datetime=now - timedelta(days=3),
            end_datetime=now - timedelta(days=3) + timedelta(hours=2),
            status="pending",
        )

        for i in range(2):
            Hire.objects.create(
                event=event, specialist=self.specialist,
                start_datetime=now - timedelta(days=i + 1),
                end_datetime=now - timedelta(days=i + 1) + timedelta(hours=2),
                status="completed",
            )

    def test_analytics_top_venues_and_specialists(self):
        """Аналитика возвращает площадки и специалистов по числу завершённых бронирований/наймов."""
        self.client.force_authenticate(self.admin_user)
        response = self.client.get("/api/auth/admin/analytics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        top_venues = response.data["top_venues"]
        self.assertEqual(top_venues[0]["id"], str(self.popular_venue.id))
        self.assertEqual(top_venues[0]["completed_bookings"], 2)
        self.assertTrue(all(v["id"] != str(self.quiet_venue.id) for v in top_venues))

        top_specialists = response.data["top_specialists"]
        self.assertEqual(top_specialists[0]["id"], str(self.specialist.user_id))
        self.assertEqual(top_specialists[0]["completed_hires"], 2)
