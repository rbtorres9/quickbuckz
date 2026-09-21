from django.urls import path
from .views import ProfileListView, PostListView, RegisterView, MyProfileView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('profiles/', ProfileListView.as_view(), name='profile-list'),
    path('profile/me/', MyProfileView.as_view(), name='my-profile'),
    path('posts/', PostListView.as_view(), name='post-list'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('signup/', RegisterView.as_view(), name='signup'),
]