from django.urls import path
from .views import NotificationListView, MarkAllReadView, UnreadCountView

urlpatterns = [
    path("notifications/", NotificationListView.as_view()),
    path("notifications/mark-all-read/", MarkAllReadView.as_view()),
    path("notifications/unread-count/", UnreadCountView.as_view()),
]