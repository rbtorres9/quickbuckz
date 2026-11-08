from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AccountSecurity, Profile, User, Follow
from moderation.admin import RestrictionInline

#the following classes are used for editing user accounts as an admin
class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False


class SecurityInline(admin.StackedInline):
    model = AccountSecurity
    can_delete = False

#the following class is used to customize Django admin pages, has ui elements that allows for the search
#of counts using methods such as username and email look up
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    inlines = [ProfileInline, SecurityInline, RestrictionInline]
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

#following code registers an admin page
@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ["id", "follower", "following", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["follower__username", "following__username"]
    autocomplete_fields = ["follower", "following"]
    list_select_related = ["follower", "following"]


