from rest_framework import serializers

from .models import Profile, Follow, FollowRequest, Block
from django.contrib.auth import get_user_model
User = get_user_model()

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

#main purpose of this code is profile serializers

class BackgroundPictureSerializer(serializers.Serializer):
    right_picture = serializers.ImageField(read_only=True)
    right_picture_flip = serializers.BooleanField(read_only=True)
    right_picture_tile = serializers.BooleanField(read_only=True)
    left_picture = serializers.ImageField(read_only=True)
    left_picture_flip = serializers.BooleanField(read_only=True)
    left_picture_tile = serializers.BooleanField(read_only=True)

#Public profile serializer is a read only public view of a user account
class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    first_name = serializers.ReadOnlyField(source='user.first_name')
    last_name = serializers.ReadOnlyField(source='user.last_name')
    followers_count = serializers.IntegerField(source='user.follower_set.count', read_only=True)
    following_count = serializers.IntegerField(source='user.following_set.count', read_only=True)

    background_picture = BackgroundPictureSerializer(source='*', read_only=True)

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
                'banner', 
                'birthday',
                'followers_count',
                'following_count',
                'created_at',
                'theme',
                'site_theme',
                'background_picture',
                ]
        read_only_fields = fields

#owner profile serializer lets the owner edit their profile data including their bio username real name etc
class OwnerProfileSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True, max_length=150)
    followers_count = serializers.IntegerField(source='user.follower_set.count', read_only=True)
    following_count = serializers.IntegerField(source='user.following_set.count', read_only=True)


    MAX_IMAGE_MB = 5

    def _validate_image(self, image):
        if image and image.size > self.MAX_IMAGE_MB * 1024 * 1024:
            raise serializers.ValidationError(f"Image must be under {self.MAX_IMAGE_MB} MB.")
        return image

    def validate_profile_picture(self, value):
        return self._validate_image(value)

    def validate_banner(self, value):
        return self._validate_image(value)

    def validate_left_picture(self, value):
        return self._validate_image(value)

    def validate_right_picture(self, value):
        return self._validate_image(value)

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)
    
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
            'banner',
            'birthday',
            'visibility', 
            'followers_count',
            'following_count',
            'created_at',
            'theme',
            'site_theme',
            'right_picture',
            'right_picture_flip',
            'right_picture_tile',
            'left_picture',
            'left_picture_flip',
            'left_picture_tile',
            ]
        read_only_fields = ['user']



#registerserializer creates new user data
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

#follow serializer adds information regarding to account follow lists such as timestamps
class FollowListSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source="user.username")
    first_name = serializers.ReadOnlyField(source="user.first_name")
    last_name = serializers.ReadOnlyField(source="user.last_name")
    followed_at = serializers.DateTimeField(read_only=True)
    is_following = serializers.BooleanField(read_only=True)
    is_requested = serializers.BooleanField(read_only=True)

    bio = serializers.SerializerMethodField()
    # hide bio of private accounts the viewer can't see
    def get_bio(self, obj):
        request = self.context.get("request")
        viewer_id = request.user.id if request else None
        if (obj.visibility == Profile.Visibility.PUBLIC
                or obj.user_id == viewer_id
                or getattr(obj, "is_following", False)):
            return obj.bio
        return None

    class Meta:
        model = Profile
        fields = ["username", "first_name", "last_name", "bio",
                  "profile_picture", "followed_at", "is_following", "is_requested"]
        
#this includes serialization regarding follow info as well
class ProfileDetailSerializer(PublicProfileSerializer):
    is_followed = serializers.BooleanField(read_only=True)
    follows_you = serializers.BooleanField(read_only=True)
    is_self = serializers.BooleanField(read_only=True)
    is_requested = serializers.BooleanField(read_only=True) 

    class Meta(PublicProfileSerializer.Meta):
        fields = PublicProfileSerializer.Meta.fields + [
            "is_followed", 
            "follows_you", 
            "is_self", 
            "is_requested", 
            "visibility"
            ]
        read_only_fields = fields

class LockedProfileSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    first_name = serializers.ReadOnlyField(source='user.first_name')
    last_name = serializers.ReadOnlyField(source='user.last_name')
    followers_count = serializers.IntegerField(source='user.follower_set.count', read_only=True)
    following_count = serializers.IntegerField(source='user.following_set.count', read_only=True)
    is_followed = serializers.BooleanField(read_only=True)
    follows_you = serializers.BooleanField(read_only=True)
    is_self = serializers.BooleanField(read_only=True)
    is_requested = serializers.BooleanField(read_only=True)

    class Meta:
        model = Profile
        fields = ['id', 'username', 'first_name', 'last_name', 'profile_picture', 'visibility',
                  'followers_count', 'following_count',
                  'is_followed', 'follows_you', 'is_self', 'is_requested']
        read_only_fields = fields



class FollowRequestSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='requester.username')
    first_name = serializers.ReadOnlyField(source='requester.first_name')
    last_name = serializers.ReadOnlyField(source='requester.last_name')
    profile_picture = serializers.ImageField(source='requester.profile.profile_picture', read_only=True)

    class Meta:
        model = FollowRequest
        fields = ['id', 'username', 'first_name', 'last_name', 'profile_picture', 'created_at']


# /api/profile/me/following/requests/
class SentFollowRequestSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='target.username')
    first_name = serializers.ReadOnlyField(source='target.first_name')
    last_name = serializers.ReadOnlyField(source='target.last_name')
    profile_picture = serializers.ImageField(source='target.profile.profile_picture', read_only=True)

    class Meta:
        model = FollowRequest
        fields = ['id', 'username', 'first_name', 'last_name', 'profile_picture', 'created_at']


# /api/forgot/username/ + /api/forgot/password
class ForgotSerializer(serializers.Serializer):
    email = serializers.EmailField()


# /api/forgot/password/verify
class ForgotPasswordVerifyTokenSerializer(serializers.Serializer):
    token = serializers.CharField()
    uid = serializers.CharField()


# /api/forgot/password/confirm
class ForgotPasswordConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    uid = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class ChangeEmailSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "password"]

    def update(self, instance, validated_data):
        validated_data.pop('password', None)
        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.ModelSerializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["old_password", "new_password"]

    def update(self, instance, validated_data):
        validated_data.pop('old_password', None)
        new_password = validated_data.pop('new_password')
        instance.set_password(new_password)
        return super().update(instance, validated_data)


class SelfDeactivateSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)


# /api/profile/me/blocks/
class BlockSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='blocked.username')
    first_name = serializers.ReadOnlyField(source='blocked.first_name')
    last_name = serializers.ReadOnlyField(source='blocked.last_name')
    profile_picture = serializers.ImageField(source='blocked.profile.profile_picture', read_only=True)

    class Meta:
        model = Block
        fields = ['id', 'username', 'first_name', 'last_name', 'profile_picture', 'created_at']
