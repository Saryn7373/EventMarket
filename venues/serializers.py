from rest_framework import serializers
from .models import Venue, VenueImage


class VenueImageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VenueImage
        fields = ['id', 'image', 'order', 'caption', 'created_at']
        read_only_fields = ['id', 'created_at']


class VenueListSerializer(serializers.ModelSerializer):
    """Короткое представление для списка"""
    owner_email = serializers.EmailField(source='owner.user.email', read_only=True)
    main_photo  = serializers.SerializerMethodField()

    class Meta:
        model  = Venue
        fields = [
            'id', 'name', 'slug', 'city', 'address',
            'capacity_min', 'capacity_max',
            'price_per_hour', 'price_per_day',
            'status', 'is_verified',
            'owner_email', 'main_photo',
        ]

    def get_main_photo(self, obj):
        return obj.main_photo


class VenueDetailSerializer(serializers.ModelSerializer):
    """Полное представление для detail/create/update"""
    owner_email = serializers.EmailField(source='owner.user.email', read_only=True)
    images      = VenueImageSerializer(many=True, read_only=True)

    class Meta:
        model  = Venue
        fields = [
            'id', 'name', 'slug',
            'description', 'short_description',
            'address', 'city', 'postal_code',
            'latitude', 'longitude',
            'capacity_min', 'capacity_max', 'area_sq_m',
            'price_per_hour', 'price_per_day',
            'min_booking_hours', 'cancellation_policy',
            'status', 'is_verified',
            'owner_email', 'images',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'is_verified', 'created_at', 'updated_at', 'owner_email']


class VenueWriteSerializer(serializers.ModelSerializer):
    """Для создания и редактирования (owner берётся из request.user)"""
    class Meta:
        model  = Venue
        fields = [
            'name',
            'description', 'short_description',
            'address', 'city', 'postal_code',
            'latitude', 'longitude',
            'capacity_min', 'capacity_max', 'area_sq_m',
            'price_per_hour', 'price_per_day',
            'min_booking_hours', 'cancellation_policy',
            'status',
        ]

    def validate(self, data):
        cap_min = data.get('capacity_min', getattr(self.instance, 'capacity_min', None))
        cap_max = data.get('capacity_max', getattr(self.instance, 'capacity_max', None))
        if cap_min and cap_max and cap_min > cap_max:
            raise serializers.ValidationError(
                {"capacity_min": "Минимальная вместимость не может быть больше максимальной."}
            )
        return data

    def create(self, validated_data):
        request = self.context['request']
        owner   = request.user.owner  # Owner профиль
        return Venue.objects.create(owner=owner, **validated_data)