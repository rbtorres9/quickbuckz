from rest_framework_simplejwt.authentication import (
    JWTAuthentication,
    default_user_authentication_rule,
)
from rest_framework_simplejwt.exceptions import AuthenticationFailed


def user_authentication_rule(user):
    return default_user_authentication_rule(user) and not user.is_deactivated


class RestrictionAwareJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.is_deactivated:
            raise AuthenticationFailed("This account is deactivated.", code="user_deactivated")
        return user