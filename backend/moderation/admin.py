from django.contrib import admin
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from posts.models import Post, Comment
from .forms import BanListForm, ReportAdminForm, ReportReviewForm
from .models import AccountRestriction, BanListEntry, ModerationLog, Report
from .services import (
    can_moderate_user,
    change_restriction_end,
    delete_content,
    dismiss_reports,
    lift_restriction,
    restrict_user,
    review_report,
)


# ---------------- Post / Comment admin deletes ----------------

# REPORT LOG: admin deletes log the mod too (used by PostAdmin / CommentAdmin in posts/admin.py)
class CloseReportsOnDeleteMixin:
    def delete_model(self, request, obj):
        delete_content(obj, request.user, source=ModerationLog.Source.ADMIN)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            delete_content(obj, request.user, source=ModerationLog.Source.ADMIN)


# ===== BAN LIST: START =====

# ---------------- Account restrictions ----------------

def restriction_status(restriction):
    if restriction.lifted_at is not None:
        return "Lifted"
    return "Active" if restriction.is_active else "Expired"


# Read-only history on the user page (used by CustomUserAdmin in accounts/admin.py)
class RestrictionInline(admin.TabularInline):
    model = AccountRestriction
    fk_name = "user"
    extra = 0
    can_delete = False
    verbose_name_plural = "Account restrictions (add, lift or change them on the Ban list page)"
    fields = ["kind", "reason", "status", "expires_at", "created_by", "lifted_at", "lifted_by", "manage"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_mod

    @admin.display(description="Status")
    def status(self, obj):
        return restriction_status(obj)

    @admin.display(description="")
    def manage(self, obj):
        url = reverse("admin:moderation_banlistentry_change", args=[obj.pk])
        return format_html('<a href="{}">Open in ban list</a>', url)


# Ban list sidebar filter: Active (default) / Expired / Lifted / All
class RestrictionStatusFilter(admin.SimpleListFilter):
    title = "status"
    parameter_name = "status"

    def lookups(self, request, model_admin):
        return [("active", "Active"), ("expired", "Expired"), ("lifted", "Lifted"), ("all", "All")]

    def choices(self, changelist):
        current = self.value() or "active"
        for value, label in self.lookup_choices:
            yield {
                "selected": current == value,
                "query_string": changelist.get_query_string({self.parameter_name: value}),
                "display": label,
            }

    def queryset(self, request, queryset):
        value = self.value() or "active"
        if value == "active":
            return queryset.active()
        if value == "expired":
            return queryset.filter(lifted_at__isnull=True, expires_at__lte=timezone.now())
        if value == "lifted":
            return queryset.filter(lifted_at__isnull=False)
        return queryset


# Ban list: add, lift, or change the end date of restrictions (every action is logged)
@admin.register(BanListEntry)
class BanListAdmin(admin.ModelAdmin):
    form = BanListForm
    list_display = ["user", "kind", "status", "until", "reason", "created_by", "created_at", "lifted_by", "lifted_at"]
    list_filter = [RestrictionStatusFilter, "kind"]
    search_fields = ["user__username", "user__email", "reason"]
    list_select_related = ["user", "created_by", "lifted_by"]
    autocomplete_fields = ["user"]
    ordering = ["-created_at"]
    actions = ["lift_selected"]

    INFO_FIELDS = ["user", "kind", "reason", "status", "created_by", "created_at", "lifted_by", "lifted_at"]

    def get_fields(self, request, obj=None):
        if obj is None:
            return ["user", "kind", "reason", "expires_at"]
        fields = self.INFO_FIELDS + ["expires_at"]
        if self.has_change_permission(request, obj):
            fields.append("lift_now")
        return fields

    def get_readonly_fields(self, request, obj=None):
        return [] if obj is None else self.INFO_FIELDS

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.current_user = request.user
        return form

    def save_model(self, request, obj, form, change):
        if not change:
            created = restrict_user(obj.user, request.user, kind=obj.kind, reason=obj.reason,
                                    expires_at=obj.expires_at, source=ModerationLog.Source.ADMIN)
            obj.pk = created.pk
            obj._state.adding = False
            return
        if form.cleaned_data.get("lift_now"):
            lift_restriction(obj, request.user, source=ModerationLog.Source.ADMIN)
        elif "expires_at" in form.changed_data:
            change_restriction_end(obj, request.user, expires_at=obj.expires_at,
                                   source=ModerationLog.Source.ADMIN)

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj) and request.user.is_mod

    def has_add_permission(self, request):
        return super().has_add_permission(request) and request.user.is_mod

    def has_change_permission(self, request, obj=None):
        if obj is not None and (not obj.is_active or not can_moderate_user(request.user, obj.user)):
            return False
        return super().has_change_permission(request, obj) and request.user.is_mod

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.display(description="Status")
    def status(self, obj):
        return restriction_status(obj)

    @admin.display(description="Until", ordering="expires_at")
    def until(self, obj):
        return obj.expires_at or "Permanent"

    @admin.action(description="Lift selected restrictions", permissions=["change"])
    def lift_selected(self, request, queryset):
        lifted = skipped = 0
        for restriction in queryset.select_related("user"):
            if not can_moderate_user(request.user, restriction.user):
                skipped += 1
                continue
            if lift_restriction(restriction, request.user, source=ModerationLog.Source.ADMIN):
                lifted += 1
        message = f"Lifted {lifted} restriction(s)."
        if skipped:
            message += f" Skipped {skipped} you can't moderate."
        self.message_user(request, message)

# ===== BAN LIST: END =====


# ---------------- Reports ----------------

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


# ---------------- Moderation log ----------------

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