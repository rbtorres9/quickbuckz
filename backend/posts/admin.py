from django.contrib import admin

from .models import Post, Like, Comment

from moderation.admin import CloseReportsOnDeleteMixin

@admin.register(Post)
class PostAdmin(CloseReportsOnDeleteMixin, admin.ModelAdmin):
    list_display = ["id", "author", "content", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["content", "author__username"]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "post", "created_at"]

@admin.register(Comment)
class CommentAdmin(CloseReportsOnDeleteMixin, admin.ModelAdmin):
    list_display = ["id", "author", "post", "content", "created_at"]
    search_fields = ["content", "author__username"]
