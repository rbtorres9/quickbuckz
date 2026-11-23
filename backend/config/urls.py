from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from django.conf import settings


def home(request):
    return HttpResponse("""
        <h1>QuickBuckz API</h1>
        <p>Backend is running. </p> 
        <ul>
        <li><a href="/api/posts/">/api/posts/</a></li>
        <li><a href="/api/profiles/">/api/profiles/</a></li>
        </ul>
    """)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home),
    path('api/', include('accounts.urls')),
    path('api/', include('posts.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('moderation.urls')),
]

# DRF login page only in DEBUG
if settings.DEBUG:
    urlpatterns += [path('api-auth/', include('rest_framework.urls'))]
