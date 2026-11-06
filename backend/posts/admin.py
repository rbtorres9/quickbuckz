from django.contrib import admin
from .models import Post, Like, Comment, Report
from django.utils import timezone  


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["id", "author", "content", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["content", "author__username"]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "post", "created_at"]

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["id", "author", "post", "content", "created_at"]
    search_fields = ["content", "author__username"]

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "comment", "reporter", "reason", "status", "reviewed_by", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["reason", "reporter__username"]
    readonly_fields = ["reviewed_by", "reviewed_at", "created_at"]

    def has_change_permission(self, request, obj=None):
        return super().has_change_permission(request, obj) and request.user.is_mod

    def save_model(self, request, obj, form, change):
        if "status" in form.changed_data:
            if obj.status == Report.Status.OPEN:
                obj.reviewed_by = None
                obj.reviewed_at = None
            else:
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)