from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, UserPostsView, ReportViewSet

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse

@api_view(["GET"])
def api_root(request, format=None):
    return Response({
        "posts": reverse("post-list", request=request),
        "profiles": reverse("profile-list", request=request),
        "signup": reverse("signup", request=request),
        "token": reverse("token_obtain_pair", request=request),
        "notifications": reverse("notification-list", request=request),
        "reports": reverse("report-list", request=request),
    })

router = DefaultRouter()
router.include_root_view = False
router.register("posts", PostViewSet, basename="post")

urlpatterns = [
    path("", api_root, name="api-root"),
    path("profile/<str:username>/posts/", UserPostsView.as_view(), name="user-posts"),
] + router.urls