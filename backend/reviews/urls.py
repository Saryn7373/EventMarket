from django.urls import path

from .views import (
    SpecialistReviewEligibilityView,
    SpecialistReviewListCreateView,
    VenueReviewEligibilityView,
    VenueReviewListCreateView,
)

urlpatterns = [
    path("venues/<uuid:venue_id>/", VenueReviewListCreateView.as_view(), name="venue-review-list"),
    path("venues/<uuid:venue_id>/eligibility/", VenueReviewEligibilityView.as_view(), name="venue-review-eligibility"),

    path("specialists/<uuid:specialist_id>/", SpecialistReviewListCreateView.as_view(), name="specialist-review-list"),
    path("specialists/<uuid:specialist_id>/eligibility/", SpecialistReviewEligibilityView.as_view(), name="specialist-review-eligibility"),
]
