from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsModerator(BasePermission):
    message = "Moderator access required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_mod)


class IsAdminRole(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAuthorOrModerator(BasePermission):
    """Read: anyone. Edit: author only. Delete: author, mod, or admin."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if obj.author == request.user:
            return True
        return (
            request.method == "DELETE"
            and request.user.is_authenticated
            and request.user.is_mod
        )