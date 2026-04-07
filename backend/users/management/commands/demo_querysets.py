from django.core.management.base import BaseCommand
from django.db.models import Count

from users.models import Renter, Specialist
from venues.models import Venue
from bookings.models import Booking


class Command(BaseCommand):
    help = 'Демонстрация values() и values_list()'

    def handle(self, *args, **options):

        # values() → список словарей
        self.stdout.write('\n--- values() ---')

        venues = Venue.objects.filter(status='published').values('name', 'city', 'price_per_hour')[:3]
        for v in venues:
            self.stdout.write(str(v))

        by_status = Booking.objects.values('status').annotate(total=Count('id'))
        for row in by_status:
            self.stdout.write(str(row))

        # values_list() → список кортежей
        self.stdout.write('\n--- values_list() ---')

        # flat=True — плоский список, удобен для передачи в __in
        emails = list(Renter.objects.values_list('user__email', flat=True)[:5])
        self.stdout.write(f'flat:  {emails}')

        # без flat — кортежи, удобны для choices в формах
        choices = list(Venue.objects.values_list('id', 'name')[:3])
        self.stdout.write(f'tuple: {choices}')

        # named=True — поля доступны по имени: row.name, row.city
        for row in Venue.objects.values_list('name', 'city', named=True)[:3]:
            self.stdout.write(f'named: name={row.name}, city={row.city}')