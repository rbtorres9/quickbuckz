from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import AccountSecurity, User


# User deactivates their own account. Content is hidden until they log back in.
def self_deactivate(user):
    now = timezone.now()
    with transaction.atomic():
        updated = (User.objects.filter(pk=user.pk, is_active=True)
                   .update(is_active=False, deactivated_at=now,
                           deactivation_type=User.DeactivationType.SELF))
        if not updated:
            raise ValueError("This account is already deactivated.")
        AccountSecurity.objects.get_or_create(user=user)
        AccountSecurity.objects.filter(user=user).update(
            self_deactivated_at=now,
            self_deactivation_count=F("self_deactivation_count") + 1,
        )
    user.is_active = False
    user.deactivated_at = now
    user.deactivation_type = User.DeactivationType.SELF


# Undo a self-deactivation (called on login). Bans are never lifted here. Returns True if reactivated.
def self_reactivate(user):
    now = timezone.now()
    with transaction.atomic():
        updated = (User.objects
                   .filter(pk=user.pk, is_active=False, deactivation_type=User.DeactivationType.SELF)
                   .update(is_active=True, deactivated_at=None, deactivation_type=""))
        if updated:
            AccountSecurity.objects.filter(user=user).update(self_reactivated_at=now)
    if updated:
        user.is_active = True
        user.deactivated_at = None
        user.deactivation_type = ""
    return bool(updated)
