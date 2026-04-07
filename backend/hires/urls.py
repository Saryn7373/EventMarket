from django.urls import path
from .views import (
    HireListCreateView,
    HireRetrieveUpdateDestroyView,
    HireStatusView,
    MyHiresView,
    SpecialistHiresView,
    SpecialistAvailabilityView,
)

urlpatterns = [
    path("", HireListCreateView.as_view(), name="hire-list"),
    path("my/", MyHiresView.as_view(), name="hire-my"),
    path("specialist/", SpecialistHiresView.as_view(), name="hire-specialist"),
    path("<uuid:pk>/", HireRetrieveUpdateDestroyView.as_view(), name="hire-detail"),
    path("<uuid:pk>/status/", HireStatusView.as_view(), name="hire-status"),
    path("specialist/<uuid:specialist_id>/availability/", SpecialistAvailabilityView.as_view(), name="specialist-availability"),
]
