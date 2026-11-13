from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import Count, F, Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsModerator
from accounts.views import visible_profiles, active_profiles
from posts.models import Post
from .models import ModerationLog, Report
from .serializers import (
    DeactivatedUserSerializer,
    DeactivateSerializer,
    DeactivationLogSerializer,
    ReportCreateSerializer,
    ReportSerializer,
)
from .services import (
    can_moderate_user,
    deactivate_user,
    dismiss_reports,
    reactivate_user,
    deactivated_users,
)

User = get_user_model()

# POST /api/posts/<pk>/report/  (was the "report" action on PostViewSet; same URL and behavior)
class PostReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

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
        # Private profiles still show their name, profile picture and banner publicly,
        # so those can break site rules even when the reporter can't follow the account.
        profile = get_object_or_404(
            active_profiles(), user__username=username.strip().lower()
        )
        can_see_private = visible_profiles(request.user).filter(pk=profile.pk).exists()

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

        # snapshot the user details when the report happens
        name = target.get_full_name()
        snapshot = f"@{target.username}" + (f" ({name})" if name else "")
        # only include the bio if the reporter could see it
        if profile.bio and can_see_private:
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
# so mods can still find deactivated users in order to reactivate them.
def get_moderatable_user(request, username):
    target = get_object_or_404(User, username=username.strip().lower())
    if not can_moderate_user(request.user, target):
        raise PermissionDenied("You can't moderate this account.")
    return target


# GET /api/profile/<username>/status/ <- current status + deactivate/reactivate history
class UserStatusView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def get(self, request, username):
        target = get_moderatable_user(request, username)
        history = (target.moderation_received
                   .filter(action__in=[ModerationLog.Action.DEACTIVATE, ModerationLog.Action.REACTIVATE])
                   .select_related("moderator"))
        return Response({
            "username": target.username,
            "is_deactivated": target.is_deactivated,
            "history": DeactivationLogSerializer(history, many=True).data,
        })


# POST   /api/profile/<username>/ban/ <- deactivate, body {"reason": "..."}
# DELETE /api/profile/<username>/ban/ <- reactivate
class UserBanView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def post(self, request, username):
        target = get_moderatable_user(request, username)
        serializer = DeactivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            entry = deactivate_user(target, request.user, reason=serializer.validated_data["reason"])
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DeactivationLogSerializer(entry).data, status=status.HTTP_201_CREATED)

    def delete(self, request, username):
        target = get_moderatable_user(request, username)
        if not reactivate_user(target, request.user):
            return Response({"detail": "This account isn't deactivated."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


# GET /api/profiles/banlist/ <- currently deactivated accounts
class BanListView(APIView):
    permission_classes = [IsAuthenticated, IsModerator]

    def get(self, request):
        deactivations = Q(moderation_received__action=ModerationLog.Action.DEACTIVATE)
        qs = (
            User.objects.filter(is_active=False)
            .annotate(
                deactivation_count=Count("moderation_received", filter=deactivations),
                last_deactivated=Max("moderation_received__created_at", filter=deactivations),
            )
            .order_by(F("last_deactivated").desc(nulls_last=True))
        )
        return Response(DeactivatedUserSerializer(qs, many=True).data)

