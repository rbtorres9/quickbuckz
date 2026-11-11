from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import Count, Max, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsModerator
from accounts.views import visible_profiles
from posts.models import Post
from .models import AccountRestriction, Report
from .serializers import (
    AccountRestrictionSerializer,
    ReportCreateSerializer,
    ReportSerializer,
    RestrictionEndSerializer,
    RestrictedUserSerializer,
)
from .services import (
    can_moderate_user,
    change_restriction_end,  # BAN LIST
    check_new_restriction,  # BAN LIST PER USER
    dismiss_reports,
    ensure_not_restricted,
    lift_restrictions,
    restrict_user,
    deactivated_users,  # DEACTIVATED CONTENT
)

User = get_user_model()
Kind = AccountRestriction.Kind

# POST /api/posts/<pk>/report/  (was the "report" action on PostViewSet; same URL and behavior)
class PostReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ensure_not_restricted(request.user, Kind.REPORTING)

        # same visibility rule PostViewSet.get_queryset() applied
        post = get_object_or_404(
            Post.objects.filter(author__in=visible_profiles(request.user).values("user")),
            pk=pk,
        )

        comment = None
        comment_id = request.data.get("comment_id")
        if comment_id:
            comment = get_object_or_404(post.comments.exclude(author__in=deactivated_users()), pk=comment_id)  # DEACTIVATED CONTENT
        target_author = comment.author if comment else post.author
        if target_author == request.user:
            return Response(
                {"detail": "You can't report your own content."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        already = Report.objects.filter(
            post=post, comment=comment, reporter=request.user, status=Report.Status.OPEN
        ).exists()
        if already:
            return Response({"detail": "You already reported this."}, status=status.HTTP_200_OK)

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(post=post, comment=comment, reporter=request.user)
        except IntegrityError:
            return Response({"detail": "You already reported this."}, status=status.HTTP_200_OK)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# mod queue
class ReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsModerator]

    def get_queryset(self):
        qs = Report.objects.select_related(
            "post__author", "comment__author", "reporter", "target_author",
            "resolution__moderator",
        )

        status_param = self.request.query_params.get("status", Report.Status.OPEN)
        if status_param != "all":
            qs = qs.filter(status=status_param)

        type_param = self.request.query_params.get("type")
        if type_param in Report.TargetType.values:
            qs = qs.filter(target_type=type_param)

        return qs

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        report = self.get_object()
        if report.status != Report.Status.OPEN:
            return Response(
                {"detail": "This report is already closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if report.target_author_id == request.user.id:
            return Response(
                {"detail": "Another moderator has to review reports on your own content."},
                status=status.HTTP_403_FORBIDDEN,
            )

        dismissed = dismiss_reports(report, request.user)

        return Response({"dismissed": dismissed}, status=status.HTTP_200_OK)



# POST /api/profile/<username>/report/
class ProfileReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        ensure_not_restricted(request.user, Kind.REPORTING)
        profile = get_object_or_404(
            visible_profiles(request.user), user__username=username.strip().lower()
        )
        target = profile.user
        if target == request.user:
            return Response({"detail": "You can't report your own profile."},
                            status=status.HTTP_400_BAD_REQUEST)

        already = Report.objects.filter(
            target_type=Report.TargetType.PROFILE, target_author=target,
            reporter=request.user, status=Report.Status.OPEN,
        ).exists()
        if already:
            return Response({"detail": "You already reported this profile."}, status=status.HTTP_200_OK)

        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = target.get_full_name()
        snapshot = f"@{target.username}" + (f" ({name})" if name else "")
        if profile.bio:
            snapshot += f"\n{profile.bio}"

        try:
            serializer.save(
                reporter=request.user,
                target_type=Report.TargetType.PROFILE,
                target_author=target,
                target_content=snapshot,
            )
        except IntegrityError:
            return Response({"detail": "You already reported this profile."}, status=status.HTTP_200_OK)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# It looks up User directly, not through visible_profiles, 
# so mods can still find deactivated users in order to lift restrictions.
def get_moderatable_user(request, username):
    target = get_object_or_404(User, username=username.strip().lower())
    if not can_moderate_user(request.user, target):
        raise PermissionDenied("You can't moderate this account.")
    return target


# GET .../restrictions <- The user's full restriction history
# POST .../restrictions <- creates a restriction
class UserRestrictionView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def get(self, request, username):
        target = get_moderatable_user(request, username)
        qs = target.restrictions.select_related("created_by", "lifted_by")
        return Response(AccountRestrictionSerializer(qs, many=True).data)

    def post(self, request, username):
        target = get_moderatable_user(request, username)
        serializer = AccountRestrictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        problem = check_new_restriction(target, serializer.validated_data["kind"])
        if problem:
            return Response({"detail": problem}, status=status.HTTP_400_BAD_REQUEST)


        restriction = restrict_user(target, request.user, **serializer.validated_data)
        return Response(AccountRestrictionSerializer(restriction).data, status=status.HTTP_201_CREATED)



# POST .../restrictions/lift <- checks that kind is valid, 
# lifts the restriction, and returns 404 if there was nothing to lift.

class LiftRestrictionView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def post(self, request, username):
        target = get_moderatable_user(request, username)
        kind = request.data.get("kind")
        if kind not in Kind.values:
            return Response({"kind": [f"Must be one of: {', '.join(Kind.values)}."]},
                            status=status.HTTP_400_BAD_REQUEST)

        lifted = lift_restrictions(target, request.user, kind=kind)
        if not lifted:
            return Response({"detail": "No active restriction of that type."},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({"lifted": lifted}, status=status.HTTP_200_OK)


class RestrictionDetailView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def patch(self, request, username, pk):
        target = get_moderatable_user(request, username)
        restriction = get_object_or_404(target.restrictions.active(), pk=pk)

        serializer = RestrictionEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        restriction = change_restriction_end(
            restriction, request.user, expires_at=serializer.validated_data["expires_at"]
        )
        return Response(AccountRestrictionSerializer(restriction).data, status=status.HTTP_200_OK)


class RestrictedUserListView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def get(self, request):
        active_q = Q(restrictions__lifted_at__isnull=True) & (
            Q(restrictions__expires_at__isnull=True)
            | Q(restrictions__expires_at__gt=timezone.now())
        )
        qs = (
            User.objects
            .annotate(
                restriction_count=Count("restrictions", distinct=True),
                active_count=Count("restrictions", filter=active_q, distinct=True),
                last_restricted=Max("restrictions__created_at"),
            )
            .filter(restriction_count__gt=0)
            .order_by("-last_restricted")
        )
        if request.query_params.get("status", "active") == "active":
            qs = qs.filter(active_count__gt=0)
        return Response(RestrictedUserSerializer(qs, many=True).data)
