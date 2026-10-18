from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["id", "recipient", "actor", "type", "post", "read", "created_at"]
    list_filter = ["type", "read", "created_at"]
    search_fields = ["recipient__username", "actor__username"]
    autocomplete_fields = ["recipient", "actor", "post"]
    raw_id_fields = ["comment"]
    list_select_related = ["recipient", "actor", "post"]
    list_editable = ["read"]
    actions = ["mark_read", "mark_unread"]

    @admin.action(description="Mark selected as read")
    def mark_read(self, request, queryset):
        queryset.update(read=True)

    @admin.action(description="Mark selected as unread")
    def mark_unread(self, request, queryset):
        queryset.update(read=False)