from django.urls import path
from .views import NotificationListView, MarkAllReadView, UnreadCountView

urlpatterns = [
   path("notifications/", NotificationListView.as_view(), name="notification-list"),
   path("notifications/mark-all-read/", MarkAllReadView.as_view(), name="notification-mark-all-read"),
   path("notifications/unread-count/", UnreadCountView.as_view(), name="notification-unread-count"),
]