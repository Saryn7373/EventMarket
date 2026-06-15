from django.urls import path

from .views import (
    AdminReviewListView,
    AdminSpecialistReviewModerateView,
    AdminVenueReviewModerateView,
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

    # ── Модерация (администратор) ──
    path("admin/", AdminReviewListView.as_view(), name="admin-review-list"),
    path("admin/venues/<uuid:pk>/moderate/", AdminVenueReviewModerateView.as_view(), name="admin-venue-review-moderate"),
    path("admin/specialists/<uuid:pk>/moderate/", AdminSpecialistReviewModerateView.as_view(), name="admin-specialist-review-moderate"),
]
