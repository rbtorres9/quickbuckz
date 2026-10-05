from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None

        try:
            user = User.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            User().set_password(password)  # keeps timing similar for misses
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None