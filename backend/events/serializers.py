from rest_framework import serializers
from .models import Event


class _RenterShortSerializer(serializers.Serializer):
    email = serializers.EmailField(source='user.email')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')


class _VenueShortSerializer(serializers.Serializer):
    id      = serializers.UUIDField()
    slug    = serializers.SlugField()
    name    = serializers.CharField()
    city    = serializers.CharField()
    address = serializers.CharField()


class _SpecialistShortSerializer(serializers.Serializer):
    id         = serializers.UUIDField(source='user.id')
    email      = serializers.EmailField(source='user.email')
    first_name = serializers.CharField(source='user.first_name')
    last_name  = serializers.CharField(source='user.last_name')
    specialty  = serializers.CharField()


class EventListSerializer(serializers.ModelSerializer):
    """Короткое представление для списка"""
    renter_info    = _RenterShortSerializer(source='renter', read_only=True)
    venues_count   = serializers.IntegerField(source='venues.count', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    theme_display  = serializers.CharField(source='get_theme_display', read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'date', 'start_time', 'end_time',
            'theme', 'theme_display', 'short_description',
            'status', 'status_display',
            'expected_guests', 'renter_info', 'venues_count',
            'created_at',
        ]


class EventDetailSerializer(serializers.ModelSerializer):
    """Полное представление для detail/create/update"""
    renter_info = _RenterShortSerializer(source='renter', read_only=True)
    venues = _VenueShortSerializer(many=True, read_only=True)
    specialists = _SpecialistShortSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    theme_display = serializers.CharField(source='get_theme_display', read_only=True)
    duration_hours = serializers.FloatField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    is_today = serializers.BooleanField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'date', 'start_time', 'end_time',
            'theme', 'theme_display', 'short_description',
            'description', 'expected_guests',
            'status', 'status_display',
            'renter_info', 'venues', 'specialists',
            'duration_hours', 'is_upcoming', 'is_today',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'renter_info', 'venues', 'specialists',
            'duration_hours', 'is_upcoming', 'is_today',
            'created_at', 'updated_at',
        ]


class EventWriteSerializer(serializers.ModelSerializer):
    """Для создания и редактирования мероприятий"""
    class Meta:
        model = Event
        fields = [
            'title', 'date', 'start_time', 'end_time',
            'theme', 'short_description', 'description',
            'expected_guests', 'status',
        ]

    def validate(self, data):
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = data.get('end_time', getattr(self.instance, 'end_time', None))

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({
                'end_time': 'Время окончания должно быть позже времени начала.'
            })

        expected_guests = data.get('expected_guests', getattr(self.instance, 'expected_guests', None))
        if expected_guests is not None and expected_guests < 1:
            raise serializers.ValidationError({
                'expected_guests': 'Количество гостей должно быть больше 0.'
            })

        return data

    def create(self, validated_data):
        request = self.context['request']
        renter = request.user.renter
        return Event.objects.create(renter=renter, **validated_data)


class EventStatusSerializer(serializers.Serializer):
    """Для изменения статуса мероприятия"""
    status = serializers.ChoiceField(choices=Event.STATUS_CHOICES)

    def validate_status(self, new_status):
        event = self.context['event']
        valid_transitions = {
            'draft': ['planned', 'cancelled'],
            'planned': ['active', 'cancelled'],
            'active': ['ongoing', 'cancelled'],
            'ongoing': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': ['draft'],
        }

        allowed = valid_transitions.get(event.status, [])
        if new_status not in allowed:
            raise serializers.ValidationError(
                f'Нельзя изменить статус с "{event.status}" на "{new_status}". '
                f'Доступные варианты: {", ".join(allowed) if allowed else "нет"}'
            )
        return new_status

    def save(self):
        event = self.context['event']
        event.status = self.validated_data['status']
        event.save(update_fields=['status', 'updated_at'])
        return event
