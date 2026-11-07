from django import forms
from .models import Report

class ReportAdminForm(forms.ModelForm):
    target_type = forms.ChoiceField(
        choices=[("post", "Post"), ("comment", "Comment")],
        initial="post",
        label="Reporting a",
    )

    class Meta:
        model = Report
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "post" in self.fields:
            self.fields["post"].required = False

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

        return cleaned
