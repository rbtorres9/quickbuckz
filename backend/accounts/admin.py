from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AccountSecurity, Profile, User

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
    list_display = ("username", "email", "is_staff", "is_active")
    search_fields = ("username", "email")

    def get_inline_instances(self, request, obj=None):
        if obj is None:
            return []
        return super().get_inline_instances(request, obj)


