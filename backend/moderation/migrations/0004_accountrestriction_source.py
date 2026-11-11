from datetime import timedelta

from django.db import migrations, models

SOURCE_CHOICES = [("app", "App"), ("admin", "Admin site"), ("system", "System")]

# A restriction and its log entry are written in the same transaction,
# so the log's created_at is a few milliseconds after the restriction's.
WINDOW = timedelta(seconds=5)


def backfill_sources(apps, schema_editor):
    AccountRestriction = apps.get_model("moderation", "AccountRestriction")
    ModerationLog = apps.get_model("moderation", "ModerationLog")

    for r in AccountRestriction.objects.all().iterator():
        changed = []

        log = (ModerationLog.objects
               .filter(action__in=["restrict", "deactivate"], target_author_id=r.user_id,
                       created_at__gte=r.created_at, created_at__lte=r.created_at + WINDOW)
               .order_by("created_at").first())
        if log:
            r.source = log.source
            changed.append("source")

        if r.lifted_at:
            log = (ModerationLog.objects
                   .filter(action="lift_restriction", target_author_id=r.user_id,
                           created_at__gte=r.lifted_at, created_at__lte=r.lifted_at + WINDOW)
                   .order_by("created_at").first())
            if log:
                r.lifted_source = log.source
                changed.append("lifted_source")

        if changed:
            r.save(update_fields=changed)


class Migration(migrations.Migration):

    dependencies = [
        ("moderation", "0003_delete_banlistentry_banlistuser"),
    ]

    operations = [
        migrations.AddField(
            model_name="accountrestriction",
            name="source",
            field=models.CharField(choices=SOURCE_CHOICES, default="app", max_length=10),
        ),
        migrations.AddField(
            model_name="accountrestriction",
            name="lifted_source",
            field=models.CharField(blank=True, choices=SOURCE_CHOICES, default="", max_length=10),
        ),
        migrations.RunPython(backfill_sources, migrations.RunPython.noop),
    ]