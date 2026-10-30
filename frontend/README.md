# Adored Vacation

React + Vite + Tailwind rebuild of the Framer design.

```bash
npm install
npm run dev
```

Pages done: `/login`, `/create-account` (placeholder).
To do: `/user-page`, `/top-content`, `/subscriptions`, `/user-account`, `/post-creation`.

TODO:
- Store access and refresh tokens securely and effectively.
- Fix bug that allows the same post to be posted multiple times when pressing the post button multiple times

UPDATES:
- Updated the /create-account page to display errors appropriately such as non-unique emails, non-unique usernames, invalid usernames, etc..
- Updated /create-account to include 'first-name' and 'last-name' in its POST JSON.stringify (modified firstName and lastName to match django User model variable names)
- Updated /create-account so that when a user register, they are automatically logged in with message "Account Created!". - RT 10/11
- Modified App.jsx by removing PublicRoute for /create-account, but also fixed the redirect logic where /create-account is still accessible with a login session (due to implementing above note). - RT 10/11
- Moved UserCacheContext and AuthContext to their own folder named 'context'
- Added a utils folder with DateTileUtils.js
- Updated /user-page to apply 'loading post' behaviour as well
- Updated Notifications behaviour (might need more testing) -RT

## Login and Account Creator
- Added basic functionality to the /create-account and /login page
- /create-account creates a new account on the database.
- /login verifies if credentials fit in the database and redirects the user to a different page on success.

## Site Functionality
- /user-page now shows the logged in user's full name, bio, and username
- /user-page also shows the current user's posts
- for now, certain features of /user-page will be hidden such as likes, followers, and following as it is not implemented on the backend
- Users can edit their bio and profile picture in /user-page (although more testing should be done)
- /home shows all posts ordered by recency - JDN 10/19
- /home and /top-content will now display if posts are being loaded in or if there was an error loading in the posts - JDN 10/21
- /top-content shows all posts and can be filtered - JDN 10/19

## UserCacheContext
- UserCacheContext provides a cache of the user's first name, last name, username, bio, and profile picture in order to reduce api calls to the backend.
- UserCacheContext is updated when the user first logs in.
- /user-page is updated to use this cache, so the only api being called is to get the user's posts

## DateTimeUtils
- This is a file that has basic functions to format dates into readable strings
- Current used in PostCard.jsx to show a post's date

## ApiResult 10/19
- This is a file that stores a simple class to contain a result and whether or not the result is an error
- This provides a way to check if an API call has failed without breaking everything

## ApiContext 10/19
- This is a React context to store a bunch of functions that will make API calls to the backend simpler
- This file is also used to prevent overriding code when the frontend has massive changes

## API_URL changes
- edited some pages to import API_URL from src/config.js, and replace hardcoded onrender backend link to API_URL variable
- to test backend (localhost:8000) locally, uncomment the line and comment the onrender line.
- **!!! Before comitting, always change API_URL to quickbuckz.onrender.com and comment out the localhost link**

## NotificationsContext.jsx 10/25
- Implements notifications logic such as time interval for when to check for new notifications, don't mark as read while the page is inactive, etc.
## Profile/settings edits 10/26 - MM
- Home's "Share a trip" box and Settings now show your real account instead of the sample user (no more "JR")
- Post photos now show the whole picture instead of cropping it
- Profile page: shows your username when you have no first/last name (no more blank circle), banner photos show, post errors show
- Posts on Home and Top now show the author's name and profile picture (PostCard loads the author's profile once if the page doesn't pass it in)
- Settings > Privacy (public/private) now saves to the database with PATCH /api/profile/me/
- Site theme and profile theme are remembered on this device (localStorage) for now
- **Backend requests:**
  - add a `theme` field to Profile (text, default "classic") so profile themes save for everyone
  - an endpoint to change email and one to change password (Settings has TODOs for both)

## Real follows + side GIF 10/26 - MM
- Follow buttons now use the backend: POST/DELETE /api/profile/<username>/follow/
- /subscriptions (Following) and /followers load real lists from /api/profile/me/following/ and /api/profile/me/followers/
- Profiles show real Followers/Following counts (yours link to those pages) and a "Follows you" tag
- Home's "Following" count is real; the notifications Follow back button reads `is_followed` from the response
- Fun: a GIF fills both sides of the page on wide screens (stretched to the side width and repeated top to bottom). Put any GIF at `frontend/public/side.gif` to change it (no file = no GIF). Hidden on phones and for people with reduced motion turned on.

## Mod mode prototype 10/26 - MM
- Settings > Moderator: enter the mod code (`qbmod` for now) to turn on mod mode; "Leave mod mode" turns it off
- /mod (Mod tools): reported posts with Remove post and Dismiss. Real posts link to the post.
- The Report button (⋯ on posts) asks for a reason and adds the post to the mod list. Real posts now have the ⋯ menu with Report (not on your own).
- Reports are sample data kept in the browser for now; they reset on refresh
- **Backend requests (needed before this is real):**
  - a moderator role on accounts (e.g. `is_moderator` or Django `is_staff`), sent with /api/profile/me/, replacing the frontend mod code
  - a Reports table + endpoints: create a report, list open reports (mods only), dismiss a report
  - let moderators DELETE any post (right now only the author can; mod tools shows a message when the backend refuses)

## Real mod access 10/30 - MM
- Mod tools now use the backend role check (GET /api/users/me/role/) through `src/utils/useIsMod.js`. Any error counts as "not a mod".
- Removed the prototype mod code (`qbmod`) and the `modMode` flag. The Moderator section in Settings only shows for mods/admins.
- To make someone a mod: Django admin site > Users > Role
- Still TODO: reports are sample data until the backend has a Reports table


## Name fields + people search 10/30 - MM
- Edit profile has First name and Last name fields (sent with PUT /api/profile/me/)
- Following page has a search bar: type a name or username to find people (filters GET /api/profiles/ in the browser)
- Fixed: opening someone else's profile crashed (leftover `result` variable in UserPage). Your own profile now updates right after Edit profile.
- **Backend request:** `first_name` / `last_name` are read-only in `OwnerProfileSerializer`, so names don't save yet (Edit profile shows a message). Make them writable, e.g.:
  ```python
  first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True, max_length=150)
  last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True, max_length=150)

  def update(self, instance, validated_data):
      user_data = validated_data.pop('user', {})
      for field, value in user_data.items():
          setattr(instance.user, field, value)
      instance.user.save()
      return super().update(instance, validated_data)
  ```
