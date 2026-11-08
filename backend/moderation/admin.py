from django.contrib import admin

from posts.models import Post, Comment
from .forms import ReportAdminForm, ReportReviewForm
from .models import AccountRestriction, ModerationLog, Report
from .services import delete_content, dismiss_reports, review_report

# REPORT LOG: admin deletes log the mod too (used by PostAdmin / CommentAdmin in posts/admin.py)
class CloseReportsOnDeleteMixin:
    def delete_model(self, request, obj):
        delete_content(obj, request.user, source=ModerationLog.Source.ADMIN)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            delete_content(obj, request.user, source=ModerationLog.Source.ADMIN)

# Account restrictions shown on the user page (used by CustomUserAdmin in accounts/admin.py)
class RestrictionInline(admin.TabularInline):
    model = AccountRestriction
    fk_name = "user"
    extra = 0
    fields = ["kind", "reason", "expires_at", "created_by", "lifted_at", "lifted_by"]
    readonly_fields = ["created_by", "lifted_by"]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "target_type", "target_author", "reporter", "reason", "status", "outcome", "reviewed_by", "created_at"]
    list_filter = ["status", "resolution__action", "created_at"]
    search_fields = ["reason", "reporter__username"]
    list_select_related = ["post__author", "comment__author", "reporter", "target_author", "resolution__moderator"]
    readonly_fields = ["status", "resolution", "created_at", "target_author", "target_content"]

    form = ReportAdminForm
    fields = ["target_type", "post", "comment", "target_author", "reporter", "reason",
              "target_content", "status", "resolution", "created_at"]
    actions = ["dismiss_selected"]

    class Media:
        js = ["moderation/report_admin.js"]

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "comment":
            kwargs["queryset"] = Comment.objects.select_related("author")
        elif db_field.name == "post":
            kwargs["queryset"] = Post.objects.select_related("author")
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    DETAIL_FIELDS = ["target_type", "post", "comment", "target_author", "target_content",
                     "reporter", "reason", "created_at"]
    REVIEW_FIELDS = ["review_status", "review_outcome", "review_by"]
    RESTRICTION_FIELDS = ["restriction_kind", "restriction_until"]
    CLOSED_FIELDS = ["status", "outcome", "reviewed_by", "resolution"]

    def get_fields(self, request, obj=None):
        if obj is None:
            return super().get_fields(request, obj)
        if obj.status != Report.Status.OPEN:
            return self.DETAIL_FIELDS + self.CLOSED_FIELDS
        fields = self.DETAIL_FIELDS + self.REVIEW_FIELDS
        if obj.target_type == Report.TargetType.PROFILE:
            fields = fields + self.RESTRICTION_FIELDS
        return fields

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            readonly = list(super().get_readonly_fields(request, obj))
            readonly.remove("target_author")
            return readonly
        return self.DETAIL_FIELDS + self.CLOSED_FIELDS


    def get_form(self, request, obj=None, **kwargs):
        kwargs["form"] = ReportAdminForm if obj is None else ReportReviewForm
        form = super().get_form(request, obj, **kwargs)
        form.current_user = request.user
        return form

    def save_model(self, request, obj, form, change):
        if not change:
            return super().save_model(request, obj, form, change)
        data = form.cleaned_data
        if data.get("review_status") != Report.Status.CLOSED:
            return
        review_report(
            obj, data["review_by"],
            outcome=data["review_outcome"],
            kind=data.get("restriction_kind") or None,
            expires_at=data.get("restriction_until"),
            source=ModerationLog.Source.ADMIN,
        )
        self.message_user(
            request, f"Report #{obj.pk} closed: {ModerationLog.Action(data['review_outcome']).label}."
        )


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