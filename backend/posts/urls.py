from rest_framework.routers import DefaultRouter
from .views import PostViewSet, UserPostsView
from django.urls import path

router = DefaultRouter()
router.register("posts", PostViewSet, basename="post")

urlpatterns = [    
    path("profile/<str:username>/posts/", UserPostsView.as_view(), name="user-posts"),
    ] + router.urls