from django.contrib import admin
from .models import Post, Like, Comment, Report, ModerationLog
from .forms import ReportAdminForm
from .moderation import delete_content, dismiss_reports

# REPORT LOG: admin deletes log the mod too
class CloseReportsOnDeleteMixin:
    def delete_model(self, request, obj):
        delete_content(obj, request.user, source=ModerationLog.Source.ADMIN)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            delete_content(obj, request.user, source=ModerationLog.Source.ADMIN)




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

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "target_type", "target_author", "reporter", "reason", "status", "outcome", "reviewed_by", "created_at"]
    list_filter = ["status", "resolution__action", "created_at"]
    search_fields = ["reason", "reporter__username"]
    list_select_related = ["post__author", "comment__author", "reporter", "target_author", "resolution__moderator"]
    readonly_fields = ["status", "resolution", "created_at", "target_author", "target_content"]

    form = ReportAdminForm
    fields = ["target_type", "post", "comment", "reporter", "reason",
              "target_author", "target_content", "status", "resolution", "created_at"]
    actions = ["dismiss_selected"]

    class Media:
        js = ["posts/report_admin.js"]

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "comment":
            kwargs["queryset"] = Comment.objects.select_related("author")
        elif db_field.name == "post":
            kwargs["queryset"] = Post.objects.select_related("author")
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_add_permission(self, request):
        return super().has_add_permission(request) and request.user.is_mod

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.status != Report.Status.OPEN:
            return False
        return super().has_change_permission(request, obj) and request.user.is_mod

    @admin.display(description="Outcome")
    def outcome(self, obj):
        return obj.resolution.get_action_display() if obj.resolution else "-"

    @admin.display(description="Reviewed by")
    def reviewed_by(self, obj):
        if obj.resolution and obj.resolution.moderator:
            return obj.resolution.moderator.username
        return "-"

    @admin.action(description="Dismiss selected reports", permissions=["change"])
    def dismiss_selected(self, request, queryset):
        total = 0
        for report in queryset.filter(status=Report.Status.OPEN):
            if report.target_author_id == request.user.id:
                continue
            total += dismiss_reports(report, request.user, source=ModerationLog.Source.ADMIN)
        self.message_user(request, f"Dismissed {total} report(s).")


class ResolvedReportInline(admin.TabularInline):
    model = Report
    fk_name = "resolution"
    fields = ["reporter", "reason", "created_at"]
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "moderator", "source", "via_reports", "reports_closed", "target_author"]
    list_filter = ["action", "source", "created_at"]
    search_fields = ["moderator__username", "target_author__username", "target_content"]
    list_select_related = ["moderator", "target_author"]
    inlines = [ResolvedReportInline]

    @admin.display(boolean=True, description="Via reports")
    def via_reports(self, obj):
        return obj.via_reports

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
