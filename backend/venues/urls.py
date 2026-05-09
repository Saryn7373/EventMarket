from django.urls import path
from .views import (
    VenueListCreateView,
    VenueRetrieveUpdateDestroyView,
    MyVenuesView,
    VenueImageUploadView,
    VenueImageDeleteView,
    VenueBySlugView,
)

urlpatterns = [
    path('',                                  VenueListCreateView.as_view(),            name='venue-list'),
    path('my/',                               MyVenuesView.as_view(),                   name='venue-my'),
    path('slug/<slug:slug>/',                 VenueBySlugView.as_view(),                name='venue-by-slug'),
    path('<uuid:pk>/',                        VenueRetrieveUpdateDestroyView.as_view(), name='venue-detail'),
    path('<uuid:pk>/images/',                 VenueImageUploadView.as_view(),           name='venue-image-upload'),
    path('<uuid:pk>/images/<int:image_id>/',  VenueImageDeleteView.as_view(),           name='venue-image-delete'),
]