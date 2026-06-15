from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from EventMarket.pagination import StandardPagination
from users.models import Specialist
from users.permissions import IsAdmin
from venues.models import Venue

from .models import SpecialistReview, VenueReview
from .permissions import IsRenter
from .serializers import (
    AdminReviewSerializer,
    ModerateReviewSerializer,
    SpecialistReviewCreateSerializer,
    SpecialistReviewSerializer,
    VenueReviewCreateSerializer,
    VenueReviewSerializer,
)
from .validators import can_review_specialist, can_review_venue


# ─────────────────────────────────────────────────────────────
# Отзывы о площадках
# ─────────────────────────────────────────────────────────────

class VenueReviewListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/reviews/venues/<uuid:venue_id>/  — список отзывов о площадке (публично)
    POST /api/reviews/venues/<uuid:venue_id>/  — оставить/обновить отзыв (только Renter)
    """

    pagination_class = StandardPagination

    def get_venue(self):
        return get_object_or_404(Venue, pk=self.kwargs["venue_id"])

    def get_queryset(self):
        return VenueReview.objects.filter(
            venue_id=self.kwargs["venue_id"], status="approved",
        ).select_related("renter__user", "renter__user__avatar")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return VenueReviewCreateSerializer
        return VenueReviewSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsRenter()]
        return [AllowAny()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["venue"] = self.get_venue()
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(
            VenueReviewSerializer(review, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class VenueReviewEligibilityView(APIView):
    """
    GET /api/reviews/venues/<uuid:venue_id>/eligibility/

    Может ли текущий пользователь оставить отзыв об этой площадке,
    и есть ли у него уже оставленный отзыв.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, venue_id):
        venue = get_object_or_404(Venue, pk=venue_id)

        if not hasattr(request.user, "renter"):
            return Response({"can_review": False, "existing_review": None})

        renter = request.user.renter
        existing = VenueReview.objects.filter(venue=venue, renter=renter).first()

        return Response({
            "can_review": can_review_venue(renter, venue),
            "existing_review": VenueReviewSerializer(existing, context={"request": request}).data if existing else None,
        })


# ─────────────────────────────────────────────────────────────
# Отзывы о специалистах
# ─────────────────────────────────────────────────────────────

class SpecialistReviewListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/reviews/specialists/<uuid:specialist_id>/  — список отзывов о специалисте (публично)
    POST /api/reviews/specialists/<uuid:specialist_id>/  — оставить/обновить отзыв (только Renter)

    `specialist_id` — это UUID пользователя (Specialist.user_id), как и в hires/specialists API.
    """

    pagination_class = StandardPagination

    def get_specialist(self):
        return get_object_or_404(Specialist, user_id=self.kwargs["specialist_id"])

    def get_queryset(self):
        return SpecialistReview.objects.filter(
            specialist__user_id=self.kwargs["specialist_id"], status="approved",
        ).select_related("renter__user", "renter__user__avatar")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SpecialistReviewCreateSerializer
        return SpecialistReviewSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsRenter()]
        return [AllowAny()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["specialist"] = self.get_specialist()
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(
            SpecialistReviewSerializer(review, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class SpecialistReviewEligibilityView(APIView):
    """
    GET /api/reviews/specialists/<uuid:specialist_id>/eligibility/

    Может ли текущий пользователь оставить отзыв об этом специалисте,
    и есть ли у него уже оставленный отзыв.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, specialist_id):
        specialist = get_object_or_404(Specialist, user_id=specialist_id)

        if not hasattr(request.user, "renter"):
            return Response({"can_review": False, "existing_review": None})

        renter = request.user.renter
        existing = SpecialistReview.objects.filter(specialist=specialist, renter=renter).first()

        return Response({
            "can_review": can_review_specialist(renter, specialist),
            "existing_review": SpecialistReviewSerializer(existing, context={"request": request}).data if existing else None,
        })


# ─────────────────────────────────────────────────────────────
# Модерация отзывов (администратор)
# ─────────────────────────────────────────────────────────────

class AdminReviewListView(APIView):
    """
    GET /api/reviews/admin/?status=pending

    Объединённый список отзывов (о площадках и специалистах) для модерации.
    По умолчанию показываются отзывы на проверке (status=pending).
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        status_filter = request.query_params.get("status", "pending")

        venue_qs = VenueReview.objects.select_related("venue", "renter__user")
        spec_qs = SpecialistReview.objects.select_related("specialist__user", "renter__user")

        if status_filter:
            venue_qs = venue_qs.filter(status=status_filter)
            spec_qs = spec_qs.filter(status=status_filter)

        reviews = list(venue_qs) + list(spec_qs)
        reviews.sort(key=lambda r: r.created_at, reverse=True)

        return Response(AdminReviewSerializer(reviews, many=True).data)


class AdminVenueReviewModerateView(APIView):
    """POST /api/reviews/admin/venues/<uuid:pk>/moderate/ — approve/reject"""

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        review = get_object_or_404(VenueReview, pk=pk)
        return _moderate(request, review)


class AdminSpecialistReviewModerateView(APIView):
    """POST /api/reviews/admin/specialists/<uuid:pk>/moderate/ — approve/reject"""

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        review = get_object_or_404(SpecialistReview, pk=pk)
        return _moderate(request, review)


def _moderate(request, review):
    serializer = ModerateReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    action = serializer.validated_data["action"]
    review.status = "approved" if action == "approve" else "rejected"
    review.save(update_fields=["status"])
    return Response(AdminReviewSerializer(review).data, status=status.HTTP_200_OK)
