# users/management/commands/seed.py
from django.core.management.base import BaseCommand
from faker import Faker
import random
from decimal import Decimal
from datetime import timedelta

from users.models import BaseUser, Renter, Owner, Specialist
from venues.models import Venue
from events.models import Event
from bookings.models import Booking
from hires.models import Hire
from payments.models import Payment
from reviews.models import VenueReview, SpecialistReview

from django.utils import timezone

fake = Faker('ru_RU')


class Command(BaseCommand):
    help = 'Seed the database with fake data'

    def add_arguments(self, parser):
        parser.add_argument('--renters',     type=int, default=10)
        parser.add_argument('--owners',      type=int, default=5)
        parser.add_argument('--specialists', type=int, default=5)
        parser.add_argument('--venues',      type=int, default=10)
        parser.add_argument('--events',      type=int, default=20)
        parser.add_argument('--bookings',    type=int, default=30)
        parser.add_argument('--hires',       type=int, default=20)
        parser.add_argument('--clear',       action='store_true')

    def handle(self, *args, **options):
        if options['clear']:
            self._clear()

        renters     = self._seed_renters(options['renters'])
        owners      = self._seed_owners(options['owners'])
        specialists = self._seed_specialists(options['specialists'])
        venues      = self._seed_venues(owners, options['venues'])
        events      = self._seed_events(renters, options['events'])
        bookings    = self._seed_bookings(events, venues, renters, options['bookings'])
        hires       = self._seed_hires(events, specialists, options['hires'])
        self._seed_payments(renters, bookings, hires)
        self._seed_reviews(bookings, hires)

        self.stdout.write(self.style.SUCCESS('✅ Seeding complete!'))

    def _clear(self):
        VenueReview.objects.all().delete()
        SpecialistReview.objects.all().delete()
        Payment.objects.all().delete()
        Hire.objects.all().delete()
        Booking.objects.all().delete()
        Event.objects.all().delete()
        Venue.objects.all().delete()
        Renter.objects.all().delete()
        Owner.objects.all().delete()
        Specialist.objects.all().delete()
        BaseUser.objects.filter(is_superuser=False).delete()
        self.stdout.write(self.style.WARNING('🗑️  Database cleared'))

    def _seed_renters(self, n):
        renters = []
        for _ in range(n):
            user = BaseUser.objects.create_user(
                email=fake.unique.email(),
                password='password123',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
            )
            renters.append(Renter.objects.create(user=user))
        self.stdout.write(f'  👤 Renters: {n}')
        return renters

    def _seed_owners(self, n):
        owners = []
        for _ in range(n):
            user = BaseUser.objects.create_user(
                email=fake.unique.email(),
                password='password123',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
            )
            owners.append(Owner.objects.create(
                user=user,
                inn=fake.numerify('############'),
                verified=fake.boolean(chance_of_getting_true=60),
                rating=Decimal(str(round(random.uniform(3.0, 5.0), 2))),
            ))
        self.stdout.write(f'  👤 Owners: {n}')
        return owners

    def _seed_specialists(self, n):
        specialties = ['Фотограф', 'DJ', 'Ведущий', 'Декоратор', 'Кейтеринг']
        specialists = []
        for _ in range(n):
            user = BaseUser.objects.create_user(
                email=fake.unique.email(),
                password='password123',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
            )
            specialists.append(Specialist.objects.create(
                user=user,
                specialty=random.choice(specialties),
                license_number=fake.numerify('LIC-#####'),
                city=fake.city(),
                rating=Decimal(str(round(random.uniform(3.0, 5.0), 2))),
                portfolio_url=fake.url(),
            ))
        self.stdout.write(f'  👤 Specialists: {n}')
        return specialists

    def _seed_venues(self, owners, n):
        statuses = ['draft', 'published', 'published', 'moderation']
        venues = []
        for _ in range(n):
            cap_min = random.randint(10, 50)
            cap_max = cap_min + random.randint(50, 200)
            venues.append(Venue.objects.create(
                owner=random.choice(owners),
                name=f"{fake.company()} Hall",
                description=fake.text(max_nb_chars=500),
                short_description=fake.text(max_nb_chars=150),
                address=fake.address(),
                city=fake.city(),
                capacity_min=cap_min,
                capacity_max=cap_max,
                area_sq_m=random.randint(50, 1000),
                price_per_hour=Decimal(str(round(random.uniform(1000, 15000), 2))),
                price_per_day=Decimal(str(round(random.uniform(20000, 150000), 2))),
                status=random.choice(statuses),
                is_verified=fake.boolean(chance_of_getting_true=50),
            ))
        self.stdout.write(f'  🏛️  Venues: {n}')
        return venues

    def _seed_events(self, renters, n):
        themes   = [c[0] for c in Event.THEME_CHOICES]
        statuses = [c[0] for c in Event.STATUS_CHOICES]
        events = []
        for _ in range(n):
            events.append(Event.objects.create(
                renter=random.choice(renters),
                title=fake.catch_phrase(),
                date=fake.date_between(start_date='-6m', end_date='+6m'),
                theme=random.choice(themes),
                short_description=fake.text(max_nb_chars=200),
                description=fake.text(max_nb_chars=800),
                expected_guests=random.randint(10, 300),
                status=random.choice(statuses),
            ))
        self.stdout.write(f'  🎉 Events: {n}')
        return events

    def _seed_bookings(self, events, venues, renters, n):
        statuses = [c[0] for c in Booking.STATUS_CHOICES]
        bookings = []
        for _ in range(n):
            start = timezone.make_aware(
                fake.date_time_between(start_date='-3m', end_date='+3m')
            )
            end = start + timedelta(hours=random.randint(2, 8))
            bookings.append(Booking.objects.create(
                event=random.choice(events),
                venue=random.choice(venues),
                renter=random.choice(renters),
                start_datetime=start,
                end_datetime=end,
                total_price=Decimal(str(round(random.uniform(5000, 100000), 2))),
                status=random.choice(statuses),
            ))
        self.stdout.write(f'  📅 Bookings: {n}')
        return bookings

    def _seed_hires(self, events, specialists, n):
        statuses = [c[0] for c in Hire.STATUS_CHOICES]
        hires = []
        for _ in range(n):
            start = timezone.make_aware(
                fake.date_time_between(start_date='-3m', end_date='+3m')
            )
            end = start + timedelta(hours=random.randint(2, 10))
            hires.append(Hire.objects.create(
                event=random.choice(events),
                specialist=random.choice(specialists),
                start_datetime=start,
                end_datetime=end,
                total_price=Decimal(str(round(random.uniform(3000, 50000), 2))),
                status=random.choice(statuses),
            ))
        self.stdout.write(f'  🤝 Hires: {n}')
        return hires

    def _seed_payments(self, renters, bookings, hires):
        from django.utils import timezone
        statuses = [c[0] for c in Payment.STATUS_CHOICES]
        count = 0
        for booking in bookings:
            status = random.choice(statuses)
            Payment.objects.create(
                payer=random.choice(renters),
                booking=booking,
                hire=None,
                amount=booking.total_price or Decimal('5000.00'),
                status=status,
                paid_at=timezone.now() if status == 'succeeded' else None,
            )
            count += 1
        for hire in hires:
            status = random.choice(statuses)
            Payment.objects.create(
                payer=random.choice(renters),
                booking=None,
                hire=hire,
                amount=hire.total_price or Decimal('3000.00'),
                status=status,
                paid_at=timezone.now() if status == 'succeeded' else None,
            )
            count += 1
        self.stdout.write(f'  💳 Payments: {count}')

    def _seed_reviews(self, bookings, hires):
        venue_count = 0
        seen_venue_pairs = set()
        for booking in bookings:
            if booking.status != 'completed':
                continue
            pair = (booking.renter_id, booking.venue_id)
            if pair in seen_venue_pairs:
                continue
            seen_venue_pairs.add(pair)
            if not fake.boolean(chance_of_getting_true=70):
                continue
            VenueReview.objects.get_or_create(
                venue=booking.venue,
                renter=booking.renter,
                defaults={
                    'rating': random.randint(3, 5),
                    'comment': fake.text(max_nb_chars=200),
                },
            )
            venue_count += 1

        specialist_count = 0
        seen_specialist_pairs = set()
        for hire in hires:
            if hire.status != 'completed':
                continue
            renter = hire.event.renter
            pair = (renter.pk, hire.specialist_id)
            if pair in seen_specialist_pairs:
                continue
            seen_specialist_pairs.add(pair)
            if not fake.boolean(chance_of_getting_true=70):
                continue
            SpecialistReview.objects.get_or_create(
                specialist=hire.specialist,
                renter=renter,
                defaults={
                    'rating': random.randint(3, 5),
                    'comment': fake.text(max_nb_chars=200),
                },
            )
            specialist_count += 1

        self.stdout.write(f'  ⭐ Venue reviews: {venue_count}')
        self.stdout.write(f'  ⭐ Specialist reviews: {specialist_count}')