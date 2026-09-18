from django.urls import path
from .views import ProfileListView, PostListView

urlpatterns = [
    path('profiles/', ProfileListView.as_view(), name='profile-list'),
    path('posts/', PostListView.as_view(), name='post-list')
]

