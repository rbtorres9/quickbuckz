from rest_framework import serializers
from .models import Profile
from django.contrib.auth import get_user_model
User = get_user_model()
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError


class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    first_name = serializers.ReadOnlyField(source='user.first_name')
    last_name = serializers.ReadOnlyField(source='user.last_name')

    class Meta:
        model = Profile
        fields = ['id', 'user', 'username', 'first_name', 'last_name', 'bio', 'profile_picture', 'created_at']
        read_only_fields = fields


class OwnerProfileSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    first_name = serializers.ReadOnlyField(source='user.first_name')
    last_name = serializers.ReadOnlyField(source='user.last_name')
    
    class Meta:
        model = Profile
        fields = [
            'id', 
            'user', 
            'username', 
            'first_name',
            'last_name',
            'bio', 
            'profile_picture', 
            'visibility', 
            'created_at'
            ]
        read_only_fields = ['user']




class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name']

    def to_internal_value(self, data):
        data = data.copy()  # request data can be an immutable QueryDict
        for key in ('username', 'email'):
            if isinstance(data.get(key), str):
                data[key] = data[key].strip().lower()
        return super().to_internal_value(data)

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def validate(self, attrs):
        candidate = User(username=attrs.get('username'), email=attrs.get('email'))
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})
        return attrs