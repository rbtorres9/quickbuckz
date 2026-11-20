from django.contrib import admin
from django.db.models import Count, Max, Q
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.html import format_html

from posts.models import Post, Comment

from .forms import ReportAdminForm, ReportReviewForm
from .models import BanListUser, ModerationLog, Report
from .services import (
    dismiss_reports,
    review_report,
    deactivated_users,
)

# Ban list: read-only list of deactivated accounts. Ban/unban on the user's page (the "Active" box).
@admin.register(BanListUser)
class BanListAdmin(admin.ModelAdmin):
    list_display = ["username", "email", "role", "deactivation_count", "last_deactivated", "manage"]
    list_display_links = None
    search_fields = ["username", "email"]
    actions = None

    def get_queryset(self, request):
        # annotate first, then order: the default ordering uses the "last_deactivated" annotation
        deactivations = Q(moderation_received__action=ModerationLog.Action.DEACTIVATE)
        return (
            self.model._default_manager.get_queryset()
            .filter(is_active=False)
            .exclude(deactivation_type=BanListUser.DeactivationType.SELF)
            .annotate(
                deactivation_count=Count("moderation_received", filter=deactivations),
                last_deactivated=Max("moderation_received__created_at", filter=deactivations),
            )
            .order_by(*self.get_ordering(request))
        )

    def get_ordering(self, request):
        return ["-last_deactivated"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def change_view(self, request, object_id, form_url="", extra_context=None):
        return HttpResponseRedirect(reverse("admin:accounts_user_change", args=[object_id]))

    @admin.display(description="Times deactivated", ordering="deactivation_count")
    def deactivation_count(self, obj):
        return obj.deactivation_count

    @admin.display(description="Deactivated at", ordering="last_deactivated")
    def last_deactivated(self, obj):
        return obj.last_deactivated or "-"


    @admin.display(description="")
    def manage(self, obj):
        url = reverse("admin:accounts_user_change", args=[obj.pk])
        return format_html('<a href="{}">Open user page</a>', url)

# --- Reports ---

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "target_type", "target_author", "reporter", "reason", "status", "outcome", "created_at", "reviewed_by", "reviewed_at"]
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
        deactivated = deactivated_users()
        if db_field.name == "comment":
            kwargs["queryset"] = Comment.objects.select_related("author").exclude(author__in=deactivated)
        elif db_field.name == "post":
            kwargs["queryset"] = Post.objects.select_related("author").exclude(author__in=deactivated)
        elif db_field.name in ("reporter", "target_author"):
            kwargs["queryset"] = db_field.related_model._default_manager.exclude(pk__in=deactivated)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    DETAIL_FIELDS = ["target_type", "post", "comment", "target_author", "target_content",
                     "reporter", "reason", "created_at"]
    REVIEW_FIELDS = ["review_status", "review_outcome", "review_by"]
    CLOSED_FIELDS = ["status", "outcome", "reviewed_by", "reviewed_at", "resolution"]

    def get_fields(self, request, obj=None):
        if obj is None:
            return super().get_fields(request, obj)
        if obj.status != Report.Status.OPEN:
            return self.DETAIL_FIELDS + self.CLOSED_FIELDS
        return self.DETAIL_FIELDS + self.REVIEW_FIELDS


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
            source=ModerationLog.Source.ADMIN,
        )

        self.message_user(
            request, f"Report #{obj.pk} closed: {ModerationLog.Action(data['review_outcome']).label}."
        )


    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.status != Report.Status.OPEN:
            return False
        return super().has_change_permission(request, obj)

    @admin.display(description="Outcome")
    def outcome(self, obj):
        return obj.resolution.get_action_display() if obj.resolution else "-"

    @admin.display(description="Reviewed by")
    def reviewed_by(self, obj):
        if obj.resolution and obj.resolution.moderator:
            return obj.resolution.moderator.username
        return "-"

    @admin.display(description="Reviewed at", ordering="resolution__created_at")
    def reviewed_at(self, obj):
        return obj.resolution.created_at if obj.resolution else "-"

    @admin.action(description="Dismiss selected reports", permissions=["change"])
    def dismiss_selected(self, request, queryset):
        total = 0
        for report in queryset.filter(status=Report.Status.OPEN):
            if report.target_author_id == request.user.id:
                continue
            total += dismiss_reports(report, request.user, source=ModerationLog.Source.ADMIN)
        self.message_user(request, f"Dismissed {total} report(s).")


# --- Moderation log ---

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

