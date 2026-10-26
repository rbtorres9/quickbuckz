from django.urls import path
from .views import ( 
    ProfileListView, 
    RegisterView, 
    MyProfileView, 
    ProfileByUsernameView, 
    FollowView, 
    FollowListView, 
    MutualFollowersView
)

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('profiles/', ProfileListView.as_view(), name='profile-list'),
    path('profile/me/', MyProfileView.as_view(), name='my-profile'),
    path('profile/<str:username>/', ProfileByUsernameView.as_view(), name='profile-detail'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('signup/', RegisterView.as_view(), name='signup'),
    path('profile/<str:username>/follow/', FollowView.as_view(), name='follow'),
    path('profile/<str:username>/following/', FollowListView.as_view(direction="following"), name='profile-following'),
    path('profile/<str:username>/followers/', FollowListView.as_view(direction="followers"), name='profile-followers'),
    path('profile/<str:username>/mutuals/', MutualFollowersView.as_view(), name='profile-mutuals'),
]