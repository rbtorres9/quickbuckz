from django.urls import path
from .views import ( 
    ProfileListView, 
    RegisterView, 
    MyProfileView, 
    ProfileByUsernameView, 
    FollowView, 
    FollowListView, 
    MutualFollowersView,
    UserRoleView,
    FollowRequestListView,
    FollowRequestDecisionView,
    SentFollowRequestListView,
    SentFollowRequestCancelView,
    ForgotUsernameView,
    ForgotPasswordView,
    ForgotPasswordTokenVerifyView,
    ForgotPasswordConfirmView,
    ChangeEmailView,
    ChangePasswordView,
    BlockView,
    BlockListView,
    SelfDeactivateView,
    FollowSuggestionsView,

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
    path('profile/me/suggestions/', FollowSuggestionsView.as_view(), name='follow-suggestions'),
    path('profile/me/followers/requests/', FollowRequestListView.as_view(), name='follow-requests'),
    path('profile/me/followers/requests/<str:username>/', FollowRequestDecisionView.as_view(), name='follow-request-decision'),
    path('profile/me/following/requests/', SentFollowRequestListView.as_view(), name='sent-follow-requests'),
    path('profile/me/following/requests/<str:username>/', SentFollowRequestCancelView.as_view(), name='sent-follow-request-cancel'),
    path('users/me/role/', UserRoleView.as_view(), name='user-role'),
    path('forgot/username/', ForgotUsernameView.as_view(), name='forgot-username'),
    path('forgot/password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('forgot/password/verify/', ForgotPasswordTokenVerifyView.as_view(), name='forgot-password-verify'),
    path('forgot/password/confirm/', ForgotPasswordConfirmView.as_view(), name='forgot-password-confirm'),
    path('profile/me/change-email/', ChangeEmailView.as_view(), name='change-email'),
    path('profile/me/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('profile/me/blocks/', BlockListView.as_view(), name='block-list'),
    path('profile/<str:username>/block/', BlockView.as_view(), name='block'),
    path('profile/me/deactivate/', SelfDeactivateView.as_view(), name='self-deactivate'),


]