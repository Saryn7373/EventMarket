from django.urls import path
from .views import (
    VenueListCreateView,
    VenueRetrieveUpdateDestroyView,
    MyVenuesView,
    VenueImageUploadView,
    VenueImageDeleteView,
)

urlpatterns = [
    path('',                              VenueListCreateView.as_view(),             name='venue-list'),
    path('my/',                           MyVenuesView.as_view(),                    name='venue-my'),
    path('<uuid:pk>/',                    VenueRetrieveUpdateDestroyView.as_view(),  name='venue-detail'),
    path('<uuid:pk>/images/',             VenueImageUploadView.as_view(),            name='venue-image-upload'),
    path('<uuid:pk>/images/<int:image_id>/', VenueImageDeleteView.as_view(),         name='venue-image-delete'),
]