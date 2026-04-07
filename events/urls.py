from django.urls import path
from .views import (
    EventListCreateView,
    EventRetrieveUpdateDestroyView,
    MyEventsView,
    EventStatusView,
)

urlpatterns = [
    path('', EventListCreateView.as_view(), name='event-list'),
    path('my/', MyEventsView.as_view(), name='event-my'),
    path('<uuid:pk>/', EventRetrieveUpdateDestroyView.as_view(), name='event-detail'),
    path('<uuid:pk>/status/', EventStatusView.as_view(), name='event-status'),
]
