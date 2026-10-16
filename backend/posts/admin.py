from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Post, Like


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["id", "author", "content", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["content", "author__username"]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "post", "created_at"]