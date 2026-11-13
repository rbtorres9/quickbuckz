from django.db.models import Exists, OuterRef
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import Follow, FollowRequest
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (Notification.objects.filter(recipient=user)
                .select_related("actor__profile", "post", "comment")
                .annotate(is_following_actor=Exists(
                    Follow.objects.filter(follower=user, following=OuterRef("actor_id"))),
                    # ===== NEW: I have a pending request to this actor (they're private) =====
                    is_requested_actor=Exists(
                    FollowRequest.objects.filter(requester=user, target=OuterRef("actor_id")))))

class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        qs = request.user.notifications.filter(read=False)
        up_to = request.data.get("up_to_id")
        if up_to is not None:
            # Accept 12 or "12"; reject anything else (including true/false) with a 400
            if isinstance(up_to, bool):
                return Response({"up_to_id": "Must be a positive integer."}, status=400)
            try:
                up_to = int(up_to)
            except (TypeError, ValueError):
                return Response({"up_to_id": "Must be a positive integer."}, status=400)
            if up_to < 1:
                return Response({"up_to_id": "Must be a positive integer."}, status=400)
            qs = qs.filter(id__lte=up_to)
        return Response({"marked_read": qs.update(read=True)})

class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"unread": request.user.notifications.filter(read=False).count()})