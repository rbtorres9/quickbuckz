from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AccountSecurity, Profile, User


@receiver(post_save, sender=User)
def create_related_rows(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
        AccountSecurity.objects.create(user=instance)