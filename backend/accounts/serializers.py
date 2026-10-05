from rest_framework import serializers
from .models import Profile, Post
from django.contrib.auth import get_user_model
User = get_user_model()


class PublicProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'user', 'bio', 'profile_picture', 'created_at']
        read_only_fields = fields


class OwnerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'user', 'bio', 'profile_picture', 'visibility', 'created_at']
        read_only_fields = ['user']


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

    def to_internal_value(self, data):
        data = data.copy()  # request data can be an immutable QueryDict
        for key in ('username', 'email'):
            if isinstance(data.get(key), str):
                data[key] = data[key].strip().lower()
        return super().to_internal_value(data)

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )