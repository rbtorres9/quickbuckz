import re
from django.core.exceptions import ValidationError


def validate_username_rules(value):
    # Accepts A-Z because the model lowercases it afterward.
    if not re.fullmatch(r"[A-Za-z0-9_.]{4,20}", value):
        raise ValidationError(
            "Usernames must be 4-20 characters: letters, numbers, underscores, and dots only."
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