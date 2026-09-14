from rest_framework import serializers
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'user', 'bio', 'profile_picture', 'created_at']

# ModelSerializer is DRF's shortcut — instead of manually listing dict keys like book_to_dict did, it looks at the Profile model's fields and auto-generates the "object → dict" logic
# class Meta is just a config block telling the serializer which model to use and which fields to include (you could list only ['bio'] if you wanted a partial view, for example)
# id isn't a field you defined — Django auto-adds a primary key called id to every model, so it's available here too