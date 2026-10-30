from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AccountSecurity, Profile, User, Follow

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False


class SecurityInline(admin.StackedInline):
    model = AccountSecurity
    can_delete = False


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    inlines = [ProfileInline, SecurityInline]
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {"fields": ("email",)}),
    )

    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_staff", "is_active")
    list_filter = UserAdmin.list_filter + ("role",)

    search_fields = ("username", "email")

    def get_inline_instances(self, request, obj=None):
        if obj is None:
            return []
        return super().get_inline_instances(request, obj)

@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ["id", "follower", "following", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["follower__username", "following__username"]
    autocomplete_fields = ["follower", "following"]
    list_select_related = ["follower", "following"]


