from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

#the following code is used for backend authentication

#looks up user via matching login value against the username field, if its correct login succeeds, else it loops back until a valid username and password is entered
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

    def user_can_authenticate(self, user):
        return super().user_can_authenticate(user) and not user.is_deactivated
