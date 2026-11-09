from django.contrib import admin
from django.db.models import Count, Exists, Max, OuterRef, Prefetch, Q
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone  # ACTIVE COUNT
from django.utils.html import format_html

from posts.models import Post, Comment
from .forms import BanAddForm, BanHistoryRowForm, BanUserForm, ReportAdminForm, ReportReviewForm
from .models import AccountRestriction, BanListUser, ModerationLog, Report
from .services import (
    can_moderate_user,
    change_restriction_end,
    delete_content,
    dismiss_reports,
    lift_restriction,
    restrict_user_many,
    review_report,
    deactivated_users,  # DEACTIVATED CONTENT
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


def _active_restrictions(user):
    # filled by BanListAdmin.get_queryset (Prefetch to_attr); fall back to a query elsewhere
    active = getattr(user, "active_restrictions", None)
    return list(user.restrictions.active()) if active is None else active


def ban_status(user):
    kinds = {r.kind for r in _active_restrictions(user)}
    if AccountRestriction.Kind.ACCOUNT in kinds:
        return "Deactivated"
    if kinds:
        labels = dict(AccountRestriction.Kind.choices)
        return "Restricted: " + ", ".join(sorted(labels[k] for k in kinds))
    return "No active restrictions"


def ban_until(user):
    active = _active_restrictions(user)
    if not active:
        return "-"
    deactivations = [r for r in active if r.kind == AccountRestriction.Kind.ACCOUNT]
    relevant = deactivations or active
    if any(r.expires_at is None for r in relevant):
        return "Permanent"
    return max(r.expires_at for r in relevant)


# Read-only history on the Users page (used by CustomUserAdmin in accounts/admin.py)
class RestrictionInline(admin.TabularInline):
    model = AccountRestriction
    fk_name = "user"
    extra = 0
    can_delete = False
    ordering = ["-created_at"]
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
        url = reverse("admin:moderation_banlistuser_change", args=[obj.user_id])
        return format_html('<a href="{}">Open in ban list</a>', url)

    class Media:
        css = {"all": ["moderation/restriction_inline.css"]}


# Restriction history on a user's Ban list page: lift or change the end date of active rows
class BanHistoryInline(admin.TabularInline):
    model = AccountRestriction
    fk_name = "user"
    form = BanHistoryRowForm
    extra = 0
    can_delete = False
    ordering = ["-created_at"]
    verbose_name = "restriction"
    verbose_name_plural = "Restriction history"
    fields = ["kind", "reason", "status", "expires_at", "lift_now",
              "created_by", "created_at", "lifted_by", "lifted_at"]
    readonly_fields = ["kind", "reason", "status", "created_by", "created_at", "lifted_by", "lifted_at"]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_mod

    def has_change_permission(self, request, obj=None):
        return request.user.is_mod and (obj is None or can_moderate_user(request.user, obj))

    @admin.display(description="Status")
    def status(self, obj):
        return restriction_status(obj)

    class Media:
        css = {"all": ["moderation/restriction_inline.css"]}



# Ban list sidebar filter: All (default, anyone ever restricted) / Deactivated / Restricted / No active
class BanStatusFilter(admin.SimpleListFilter):
    title = "status"
    parameter_name = "status"

    def lookups(self, request, model_admin):
        return [("all", "All"), ("deactivated", "Deactivated"),
                ("restricted", "Restricted features"), ("clear", "No active restrictions")]

    def choices(self, changelist):
        current = self.value() or "all"
        for value, label in self.lookup_choices:
            yield {
                "selected": current == value,
                "query_string": changelist.get_query_string({self.parameter_name: value}),
                "display": label,
            }

    def queryset(self, request, queryset):
        active = AccountRestriction.objects.active().filter(user=OuterRef("pk"))
        deactivated = active.filter(kind=AccountRestriction.Kind.ACCOUNT)
        value = self.value() or "all"
        if value == "deactivated":
            return queryset.filter(Exists(deactivated))
        if value == "restricted":
            return queryset.filter(Exists(active)).exclude(Exists(deactivated))
        if value == "clear":
            return queryset.filter(restriction_count__gt=0).exclude(Exists(active))
        return queryset.filter(restriction_count__gt=0)


# Ban list: one row per user; their page holds the full history and the "Add restriction" section
@admin.register(BanListUser)
class BanListAdmin(admin.ModelAdmin):
    form = BanUserForm
    add_form = BanAddForm
    inlines = [BanHistoryInline]
    list_display = ["username", "email", "status", "until", "active_count", "last_restricted"]
    list_display_links = ["username"]
    list_filter = [BanStatusFilter]
    search_fields = ["username", "email"]
    actions = ["lift_all_selected"]

    INFO_FIELDS = ["username", "email", "role", "status", "until"]
    ADD_FIELDS = ["add_kinds", "add_reason", "add_until"]

    class Media:
        js = ["moderation/ban_list_admin.js"]

    def get_queryset(self, request):
        # annotate first, then order: the default ordering uses the "last_restricted" annotation
        return (
            self.model._default_manager.get_queryset()
            .annotate(
                restriction_count=Count("restrictions", distinct=True),
                active_count=Count(
                    "restrictions",
                    filter=Q(restrictions__lifted_at__isnull=True) & (
                        Q(restrictions__expires_at__isnull=True)
                        | Q(restrictions__expires_at__gt=timezone.now())
                    ),
                    distinct=True,
                ),                
                last_restricted=Max("restrictions__created_at"),
            )
            .prefetch_related(Prefetch(
                "restrictions",
                queryset=AccountRestriction.objects.active(),
                to_attr="active_restrictions",
            ))
            .order_by(*self.get_ordering(request))
        )

    def get_ordering(self, request):
        return ["-last_restricted"]

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return [(None, {"fields": ["user"] + self.ADD_FIELDS})]
        fieldsets = [(None, {"fields": self.INFO_FIELDS})]
        if self.has_change_permission(request, obj):
            fieldsets.append(("Add restriction", {"fields": self.ADD_FIELDS}))
        return fieldsets

    def get_readonly_fields(self, request, obj=None):
        return [] if obj is None else self.INFO_FIELDS

    def get_inline_instances(self, request, obj=None):
        return [] if obj is None else super().get_inline_instances(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        kwargs["form"] = self.add_form if obj is None else self.form
        form = super().get_form(request, obj, **kwargs)
        form.current_user = request.user
        return form

    def save_model(self, request, obj, form, change):
        target = obj if change else form.cleaned_data["user"]
        kinds = form.cleaned_data.get("add_kinds") or []
        if kinds:
            restrict_user_many(
                target, request.user, kinds=kinds,
                reason=form.cleaned_data["add_reason"],
                expires_at=form.cleaned_data.get("add_until"),
                source=ModerationLog.Source.ADMIN,
            )
        if not change:
            # nothing new was saved on the user; point the admin at the existing account
            obj.pk = target.pk
            obj.username = target.username
            obj._state.adding = False

    def response_add(self, request, obj, post_url_continue=None):
        # after adding, open the user's ban list page (history + what was just added)
        self.message_user(request, f"Restrictions added for {obj.username}.")
        return HttpResponseRedirect(reverse("admin:moderation_banlistuser_change", args=[obj.pk]))

    def save_formset(self, request, form, formset, change):
        if formset.model is not AccountRestriction:
            return super().save_formset(request, form, formset, change)
        # rows are saved through the services (logged), not formset.save(); fill in what the
        # admin's change history reads afterwards
        formset.new_objects, formset.deleted_objects, formset.changed_objects = [], [], []
        for row in formset.forms:
            restriction = row.instance
            if restriction.pk is None or not row.has_changed():
                continue
            if row.cleaned_data.get("lift_now"):
                lift_restriction(restriction, request.user, source=ModerationLog.Source.ADMIN)
            elif "expires_at" in row.changed_data:
                change_restriction_end(restriction, request.user,
                                       expires_at=row.cleaned_data["expires_at"],
                                       source=ModerationLog.Source.ADMIN)
            else:
                continue
            formset.changed_objects.append((restriction, row.changed_data))

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj) and request.user.is_mod

    def has_add_permission(self, request):
        return super().has_add_permission(request) and request.user.is_mod

    def has_change_permission(self, request, obj=None):
        if obj is not None and not can_moderate_user(request.user, obj):
            return False
        return super().has_change_permission(request, obj) and request.user.is_mod

    def has_delete_permission(self, request, obj=None):
        return False  # a row here IS the user account; restrictions are lifted, never deleted

    @admin.display(description="Status")
    def status(self, obj):
        return ban_status(obj)

    @admin.display(description="Until")
    def until(self, obj):
        return ban_until(obj)

    @admin.display(description="Active restrictions", ordering="active_count")
    def active_count(self, obj):
        return obj.active_count

    @admin.display(description="Last restricted", ordering="last_restricted")
    def last_restricted(self, obj):
        return obj.last_restricted

    @admin.action(description="Lift all active restrictions of selected users", permissions=["change"])
    def lift_all_selected(self, request, queryset):
        lifted = skipped = 0
        for user in queryset:
            if not can_moderate_user(request.user, user):
                skipped += 1
                continue
            for restriction in user.restrictions.active():
                if lift_restriction(restriction, request.user, source=ModerationLog.Source.ADMIN):
                    lifted += 1
        message = f"Lifted {lifted} restriction(s)."
        if skipped:
            message += f" Skipped {skipped} user(s) you can't moderate."
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