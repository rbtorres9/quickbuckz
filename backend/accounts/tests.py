from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Follow, FollowRequest, Profile

User = get_user_model()


class PrivateProfileTests(APITestCase):
    def setUp(self):
        # The signal in signals.py creates each user's Profile automatically
        self.alice = User.objects.create_user(username="alice", email="a@x.com", password="pw-Test-12345")
        self.bob = User.objects.create_user(username="bob", email="b@x.com", password="pw-Test-12345")
        self.carol = User.objects.create_user(username="carol", email="c@x.com", password="pw-Test-12345")
        Profile.objects.filter(user=self.alice).update(visibility="private", bio="secret bio")

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    # --- Locked card ---
    def test_non_follower_gets_locked_card(self):
        self.as_user(self.bob)
        r = self.client.get("/api/profile/alice/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["is_locked"])
        self.assertNotIn("bio", r.data)

    def test_logged_out_gets_locked_card(self):
        r = self.client.get("/api/profile/alice/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["is_locked"])

    def test_missing_user_still_404(self):
        self.assertEqual(self.client.get("/api/profile/nobody/").status_code, 404)

    def test_owner_sees_own_private_profile(self):
        self.as_user(self.alice)
        r = self.client.get("/api/profile/alice/")
        self.assertNotIn("is_locked", r.data)
        self.assertEqual(r.data["bio"], "secret bio")

    def test_non_follower_cannot_see_posts(self):
        self.as_user(self.bob)
        self.assertEqual(self.client.get("/api/profile/alice/posts/").status_code, 404)

    # --- Sending and cancelling requests ---
    def test_follow_private_creates_request(self):
        self.as_user(self.bob)
        r = self.client.post("/api/profile/alice/follow/")
        self.assertEqual(r.status_code, 202)
        self.assertTrue(r.data["is_requested"])
        self.assertFalse(r.data["is_followed"])
        self.assertEqual(self.client.post("/api/profile/alice/follow/").status_code, 200)  # repeat changes nothing
        self.assertEqual(FollowRequest.objects.count(), 1)
        self.assertTrue(self.client.get("/api/profile/alice/").data["is_requested"])

    def test_cancel_request(self):
        self.as_user(self.bob)
        self.client.post("/api/profile/alice/follow/")
        r = self.client.delete("/api/profile/alice/follow/")
        self.assertFalse(r.data["is_requested"])
        self.assertFalse(FollowRequest.objects.exists())

    def test_follow_public_still_direct(self):
        self.as_user(self.alice)
        r = self.client.post("/api/profile/bob/follow/")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["is_followed"])
        self.assertFalse(FollowRequest.objects.exists())

    # --- Listing, accepting and declining ---
    def test_request_list_only_shows_mine(self):
        self.as_user(self.bob)
        self.client.post("/api/profile/alice/follow/")
        self.as_user(self.alice)
        self.assertEqual([x["username"] for x in self.client.get("/api/follow-requests/").data], ["bob"])
        self.as_user(self.carol)
        self.assertEqual(self.client.get("/api/follow-requests/").data, [])

    def test_accept_unlocks_profile_and_posts(self):
        self.as_user(self.bob)
        self.client.post("/api/profile/alice/follow/")
        self.as_user(self.alice)
        self.assertEqual(self.client.post("/api/follow-requests/bob/").status_code, 200)
        self.assertTrue(Follow.objects.filter(follower=self.bob, following=self.alice).exists())
        self.assertFalse(FollowRequest.objects.exists())

        self.as_user(self.bob)
        r = self.client.get("/api/profile/alice/")
        self.assertNotIn("is_locked", r.data)
        self.assertEqual(r.data["bio"], "secret bio")
        self.assertEqual(self.client.get("/api/profile/alice/posts/").status_code, 200)

    def test_decline(self):
        self.as_user(self.bob)
        self.client.post("/api/profile/alice/follow/")
        self.as_user(self.alice)
        self.assertEqual(self.client.delete("/api/follow-requests/bob/").status_code, 200)
        self.assertFalse(Follow.objects.exists())
        self.assertEqual(self.client.delete("/api/follow-requests/bob/").status_code, 404)  # already gone

    def test_cannot_accept_someone_elses_request(self):
        self.as_user(self.bob)
        self.client.post("/api/profile/alice/follow/")
        self.as_user(self.carol)
        self.assertEqual(self.client.post("/api/follow-requests/bob/").status_code, 404)

    def test_unfollow_relocks(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        self.as_user(self.bob)
        self.client.delete("/api/profile/alice/follow/")
        self.assertTrue(self.client.get("/api/profile/alice/").data["is_locked"])