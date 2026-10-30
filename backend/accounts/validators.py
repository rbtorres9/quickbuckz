import re
from django.core.exceptions import ValidationError

from datetime import datetime
from django.utils import timezone


def validate_username_rules(value):
    # Accepts A-Z because the model lowercases it afterward.
    if not re.fullmatch(r"[A-Za-z0-9_.]{3,20}", value):
        raise ValidationError(
            "Usernames must be 3-20 characters: letters, numbers, underscores, and dots only."
        )
    if value[0] == "." or value[-1] == ".":
        raise ValidationError("Usernames cannot start or end with a dot.")
    if ".." in value:
        raise ValidationError("Usernames cannot contain consecutive dots.")
    if "___" in value:
        raise ValidationError("Usernames cannot contain more than two underscores in a row.")
    if sum(c.isalnum() for c in value) < 2:
        raise ValidationError("Usernames need at least two letters or numbers.")
    if not any(c.isalpha() for c in value):
        raise ValidationError("Usernames need at least one letter.")

    reserved_keywords = [ 'me', 'follow', 'following', 'followers', 'posts', 'admin', 'like', 'comment', 'posts', 'post']
    if value.lower() in reserved_keywords:
        raise ValidationError("Usernames cannot use reserved words.")


MINIMUM_AGE = 12

def calculate_age(birthday, today):
    return (today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day)))

def validate_minimum_age(value):
    if value is None:
        return

    if isinstance(value, datetime):
        value = timezone.localtime(value).date() if timezone.is_aware(value) else value.date()

    today = timezone.localdate()

    if value > today:
        raise ValidationError("Birthday cannot be in the future.")

    if calculate_age(value, today) < MINIMUM_AGE:
        raise ValidationError(f"You must be at least {MINIMUM_AGE} years old per TOS.")