from rest_framework import serializers
from .models import Profile, Post
from django.contrib.auth.models import User

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'user', 'bio', 'profile_picture', 'created_at']

# ModelSerializer is DRF's shortcut — instead of manually listing dict keys like book_to_dict did, it looks at the Profile model's fields and auto-generates the "object → dict" logic
# class Meta is just a config block telling the serializer which model to use and which fields to include (you could list only ['bio'] if you wanted a partial view, for example)
# id isn't a field you defined — Django auto-adds a primary key called id to every model, so it's available here too


class PostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source='author.username')
    class Meta:
        model = Post
        fields = ['id', 'author', 'content', 'image', 'created_at', 'updated_at']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user