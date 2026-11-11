from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    LiftRestrictionView,
    PostReportView,
    ProfileReportView,
    ReportViewSet,
    RestrictionDetailView,  # BAN LIST
    UserRestrictionView,
)

router = DefaultRouter()
router.include_root_view = False
router.register("reports", ReportViewSet, basename="report")

# Same URLs as before the move, so the frontend needs no changes
urlpatterns = [
    path("posts/<int:pk>/report/", PostReportView.as_view(), name="post-report"),
    path("profile/<str:username>/report/", ProfileReportView.as_view(), name="profile-report"),
    path("profile/<str:username>/restrictions/", UserRestrictionView.as_view(), name="profile-restrictions"),
    path("profile/<str:username>/restrictions/lift/", LiftRestrictionView.as_view(), name="profile-restrictions-lift"),
    path("profile/<str:username>/restrictions/<int:pk>/", RestrictionDetailView.as_view(), name="profile-restriction-detail"),
] + router.urls