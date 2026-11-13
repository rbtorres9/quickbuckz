from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BanListView,
    PostReportView,
    ProfileReportView,
    ReportViewSet,
    UserBanView,
    UserStatusView,
)

router = DefaultRouter()
router.include_root_view = False
router.register("reports", ReportViewSet, basename="report")

urlpatterns = [
    path("posts/<int:pk>/report/", PostReportView.as_view(), name="post-report"),
    path("profile/<str:username>/report/", ProfileReportView.as_view(), name="profile-report"),
    path("profile/<str:username>/status/", UserStatusView.as_view(), name="profile-status"),
    path("profile/<str:username>/ban/", UserBanView.as_view(), name="profile-ban"),
    path("profiles/banlist/", BanListView.as_view(), name="ban-list"),
] + router.urls