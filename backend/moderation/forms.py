from django import forms
from django.contrib.admin.widgets import AdminSplitDateTime
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from .models import AccountRestriction, BanListUser, ModerationLog, Report
from .services import can_moderate_user, check_new_restriction
from accounts.views import visible_profiles



User = get_user_model()
Action = ModerationLog.Action


# Add Report in Admin
class ReportAdminForm(forms.ModelForm):
    target_type = forms.ChoiceField(
        choices=Report.TargetType.choices,
        initial=Report.TargetType.POST,
        label="Reporting a",
    )

    class Meta:
        model = Report
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "post" in self.fields:
            self.fields["post"].required = False
        if "target_author" in self.fields:
            self.fields["target_author"].label = "Reported user"

    def clean(self):
        cleaned = super().clean()
        target = cleaned.get("target_type")

        if target == "comment":
            comment = cleaned.get("comment")
            if not comment:
                self.add_error("comment", "Pick the comment being reported.")
            else:
                cleaned["post"] = comment.post
        elif target == "post":
            cleaned["comment"] = None
            if not cleaned.get("post"):
                self.add_error("post", "Pick the post being reported.")
        elif target == "profile":
            cleaned["post"] = None
            cleaned["comment"] = None
            if not cleaned.get("target_author"):
                self.add_error("target_author", "Pick the user being reported.")

        reporter = cleaned.get("reporter")
        if target in ("post", "comment"):
            post = cleaned.get("post")
            owner = post.author if post else None
        else:
            owner = cleaned.get("target_author")

        if reporter:
            # can't report content from a profile they can't see (private, not following)
            if owner and not visible_profiles(reporter).filter(user=owner).exists():
                self.add_error(
                    "reporter",
                    f"@{reporter.username} can't see @{owner.username}'s profile "
                    "(it's private and they don't follow it), so they can't report this.",
                )

            # can't report while restricted from reporting
            restriction = reporter.active_restriction(AccountRestriction.Kind.REPORTING)
            if restriction:
                until = (f"until {restriction.expires_at:%Y-%m-%d %H:%M} UTC"
                         if restriction.expires_at else "until a moderator lifts it")
                self.add_error(
                    "reporter",
                    f"@{reporter.username} is restricted from reporting {until}.",
                )

        return cleaned


OUTCOMES_BY_TYPE = {
    Report.TargetType.POST: [Action.DISMISS, Action.REMOVE_POST],
    Report.TargetType.COMMENT: [Action.DISMISS, Action.REMOVE_COMMENT],
    Report.TargetType.PROFILE: [Action.DISMISS, Action.DEACTIVATE, Action.RESTRICT],
}

# Report Edit Page (open reports)
class ReportReviewForm(forms.ModelForm):
    review_status = forms.ChoiceField(choices=Report.Status.choices, label="Status")
    review_outcome = forms.ChoiceField(required=False, label="Outcome")
    review_by = forms.ModelChoiceField(
        queryset=User.objects.filter(
            Q(role__in=[User.Role.MODERATOR, User.Role.ADMIN]) | Q(is_superuser=True)
        ).order_by("username"),
        required=False,
        label="Reviewed by",
    )
    restriction_kind = forms.ChoiceField(
        required=False,
        label="Feature to restrict",
        choices=[("", "---------")] + [
            c for c in AccountRestriction.Kind.choices if c[0] != AccountRestriction.Kind.ACCOUNT
        ],
    )
    restriction_until = forms.SplitDateTimeField(
        required=False,
        widget=AdminSplitDateTime(),
        label="Until",
        help_text="Leave empty for permanent.",
    )

    current_user = None  # set per request in ReportAdmin.get_form

    class Meta:
        model = Report
        fields = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        actions = OUTCOMES_BY_TYPE.get(self.instance.target_type, [Action.DISMISS])
        self.fields["review_outcome"].choices = [("", "---------")] + [(a.value, a.label) for a in actions]
        self.fields["review_status"].initial = self.instance.status
        if self.current_user is not None and self.current_user.is_mod:
            self.fields["review_by"].initial = self.current_user.pk

    def clean(self):
        cleaned = super().clean()
        report = self.instance
        status = cleaned.get("review_status")
        outcome = cleaned.get("review_outcome")
        reviewer = cleaned.get("review_by")

        if status == Report.Status.OPEN:
            if outcome:
                self.add_error("review_outcome", "Set Status to Closed to apply an outcome.")
            return cleaned

        missing = False
        if not outcome:
            self.add_error("review_outcome", "Pick an outcome to close this report.")
            missing = True
        if not reviewer:
            self.add_error("review_by", "Pick the reviewing moderator.")
            missing = True
        if missing:
            return cleaned

        if reviewer.pk == report.target_author_id:
            self.add_error("review_by", "Another moderator has to review reports on their own content.")
        if outcome == Action.REMOVE_POST and report.post is None:
            self.add_error("review_outcome", "This post no longer exists.")
        if outcome == Action.REMOVE_COMMENT and report.comment is None:
            self.add_error("review_outcome", "This comment no longer exists.")

        if outcome in (Action.DEACTIVATE, Action.RESTRICT):
            target = report.target_author
            kind = (AccountRestriction.Kind.ACCOUNT if outcome == Action.DEACTIVATE
                    else cleaned.get("restriction_kind"))
            until = cleaned.get("restriction_until")
            if not kind:
                self.add_error("restriction_kind", "Pick which feature to restrict.")
            elif target is None:
                self.add_error("review_outcome", "The reported user no longer exists.")
            elif not can_moderate_user(reviewer, target):
                self.add_error("review_by", "This moderator can't act on that account.")
            elif (problem := check_new_restriction(target, kind)):
                self.add_error("restriction_kind", problem)
            if until and until <= timezone.now():
                self.add_error("restriction_until", "Must be in the future.")

        return cleaned


class BanUserForm(forms.ModelForm):
    add_kinds = forms.MultipleChoiceField(
        choices=AccountRestriction.Kind.choices,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        label="Restrict",
        help_text="Account deactivates the whole account, so the other boxes turn off while it is checked.",
    )
    add_reason = forms.CharField(required=False, max_length=200, label="Reason")
    add_until = forms.SplitDateTimeField(
        required=False,
        widget=AdminSplitDateTime(),
        label="Until",
        help_text="Leave empty for permanent.",
    )

    current_user = None  # set per request in BanListAdmin.get_form

    class Meta:
        model = BanListUser
        fields = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.instance if self.instance.pk else None
        if user is not None:
            kinds = self.fields["add_kinds"]
            if user.is_deactivated:
                kinds.choices = []
                kinds.help_text = ("This account is deactivated. Lift the deactivation in the history "
                                   "below before adding feature restrictions.")
            else:
                kinds.choices = [(k, label) for k, label in AccountRestriction.Kind.choices
                                 if not user.active_restriction(k)]


    def target_user(self):
        return self.instance

    def clean(self):
        cleaned = super().clean()
        kinds = cleaned.get("add_kinds") or []
        if not kinds:
            if cleaned.get("add_reason") or cleaned.get("add_until"):
                self.add_error("add_kinds", "Pick at least one thing to restrict.")
            return cleaned

        user = self.target_user()
        if user is None:
            return cleaned

        if AccountRestriction.Kind.ACCOUNT in kinds and len(kinds) > 1:
            self.add_error("add_kinds", "Account deactivation already blocks everything. Select it on its own.")

        reason = (cleaned.get("add_reason") or "").strip()
        if not reason:
            self.add_error("add_reason", "Please give a reason.")
        cleaned["add_reason"] = reason

        until = cleaned.get("add_until")
        if until and until <= timezone.now():
            self.add_error("add_until", "Must be in the future. Leave empty for permanent.")

        if self.current_user is not None and not can_moderate_user(self.current_user, user):
            self.add_error(None, "You can't moderate this account.")
        else:
            for kind in kinds:
                problem = check_new_restriction(user, kind)
                if problem:
                    self.add_error("add_kinds", f"{AccountRestriction.Kind(kind).label}: {problem}")
        return cleaned


class BanAddForm(BanUserForm):
    user = forms.ModelChoiceField(queryset=User.objects.order_by("username"), label="User")

    def target_user(self):
        return self.cleaned_data.get("user")

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("user") and not cleaned.get("add_kinds"):
            self.add_error("add_kinds", "Pick at least one thing to restrict.")
        return cleaned


class BanHistoryRowForm(forms.ModelForm):
    lift_now = forms.BooleanField(required=False, label="Lift")

    class Meta:
        model = AccountRestriction
        fields = ["expires_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.is_active:
            self.fields["expires_at"].disabled = True
            self.fields["lift_now"].disabled = True

    def clean_expires_at(self):
        value = self.cleaned_data.get("expires_at")
        if "expires_at" in self.changed_data and value is not None and value <= timezone.now():
            raise forms.ValidationError("Must be in the future. Leave empty for permanent.")
        return value

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("lift_now") and "expires_at" in self.changed_data:
            self.add_error("lift_now", "Either lift it or change its end date, not both.")
        return cleaned