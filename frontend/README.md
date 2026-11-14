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
  **UPDATE** fixed now. refer to backend/uodate docs/ownerprofile_firstlastname_changes.md -RT

## Delete posts + Home feed 10/30 - MM
- Your own posts have Delete in the ⋯ menu (DELETE /api/posts/<id>/). Anyone else's has Report.
- Home only shows posts from people you follow, plus your own (uses /api/profile/me/following/)


## /mod page working post delete function -RT
- the mod access button in account settings is only visible to accounts with mod or admin status from backend
- reviewed regular user if they can access mod page: mod access button not visible, they cannot access the mod page through manual URL path input as well
- so far only two functions: delete and dismiss. delete removes the post from both posts and reports api. dismiss removes the post in reports api
- **TODO**: still needs comment options from the frontend to delete or report the comment, in order to test report function
## Edit posts, share, follower lists 11/06 - MM
- Your own posts have Edit in the ⋯ menu: edit the text in place, Save sends PATCH /api/posts/<id>/ with `content` (empty posts are blocked)
- Share button on real posts: phone share sheet if there is one, otherwise copies the post link
- On someone's profile, their Followers/Following counts open their lists: /user/<username>/followers and /user/<username>/following (no Follow button on your own row)
- Fixed Notifications "Follow back" (it still read the old reply format from before the ApiResult change)

## Password reset pages, phone fixes, sample-data cleanup 11/06 - MM
- /forgot "Forgot password" now sends `POST /api/password/forgot/` with `{ email }`. It always shows the same "if an account uses this email..." message so nobody can use it to check which emails have accounts.
- New page /reset-password?token=... (the link in the reset email): new password + confirm, sends `POST /api/password/reset/` with `{ token, password }`. Shows the backend's error (like an expired link) and a Sign in button when it works.
- Until those endpoints exist, both pages say "Password reset isn't available yet."
- **Backend notes for password reset:**
  - The endpoint names above are placeholders. Change `FORGOT_PASSWORD_URL` in ForgotAccount.jsx and `RESET_PASSWORD_URL` in ResetPassword.jsx if you pick different ones.
  - Forgot password must **email** the link `https://<site>/reset-password?token=...` and must **not** return the token in the response, or anyone could reset anyone's password by typing their email.
  - Return the same response whether or not the email has an account.
  - Make the token single-use and short-lived (Django's `default_token_generator` + `PasswordResetTokenGenerator` does this), and run the normal password validators on reset.
- Phone fixes: theme picker shows 3 per row on phones so names like "Midnight" aren't cut off; the selected filter tab in Mod tools was white text on the green, now dark and readable.
- Removed the old sample data: `store.jsx` now only keeps the two themes (TODO: move to the backend). PostCard only handles real posts now. Removed the placeholder photo CSS.

## Search 11/06 - MM
- Search icon in the top bar (next to the bell) on every page, phones too. Opens /search.
- /search?q=... finds people (name or username) and posts (text or author) as you type. The search stays in the address bar, so Back and links work.
- Loads /api/profiles/ and /api/posts once and filters in the browser. TODO: backend search endpoint if the site gets big.

## Mod delete anywhere 11/06 - MM
- Mods/admins see "Delete (mod)" in the ⋯ menu on anyone's post (next to Report). Uses DELETE /api/posts/<id>/, which the backend already allows for mods.
- `useIsMod()` now asks GET /api/users/me/role/ once per account and shares the answer, so a page full of posts doesn't send one request per post.
- PostPage (separate zip, `mod-comments-update.zip`): mods see Delete on every comment. Also fixed `ownsPost` (compared to `userCache.handle`, which doesn't exist, now `userCache.username`), so post owners can delete comments on their own posts.
- The buttons are only for looks; the backend checks every delete.

## Left side picture 11/06 - MM
- Left side now shows one picture (`frontend/public/side-left.png`), as big as fits, centered. Right side keeps the repeating `side.gif`.
- For a .jpg or .gif, change `LEFT_PICTURE` in Layout.jsx to match the file name. No picture = the GIF on both sides like before.

## Phone sideways-scroll fix 11/06 - MM
- Long words and links (like a pasted URL) pushed some pages wider than a phone, so you could scroll sideways (post page comments, Mod tools reports, someone's followers list title). Added `main { overflow-wrap: anywhere; }` in index.css so they wrap.
- PostPage comments: added `min-w-0` to the comment text and the comment box so they can shrink and wrap.
- Checked every page at 320, 360, 390 and 412 px wide with long names, links and big numbers: no sideways scrolling.
- The side GIF/picture are hidden on phones on purpose (no room next to the posts).


## Profile Reporting and Banning 11/13 - RT
- The Report option in the `...` menu on another user's profile now works. It asks for a reason and sends it to `POST /api/profile/<username>/report/`. Reporting yourself, or reporting the same profile twice while the first report is still open, returns a message instead of creating a report.
- The Ban (mod) option in the profile `...` menu now asks for a reason, asks the mod to confirm, then sends `POST /api/profile/<username>/ban/`. After a successful ban it opens the user's status page (`/mod/<username>/status`), which shows the ban and a Reactivate button.
- Open profile reports that you can review now say "Click Account status or View Profile to take action." above the Dismiss and View profile buttons.
  - `frontend/src/pages/ModTools.jsx`: added inside the `canReview` branch, with `w-full` so it gets its own line in the button row.
- The backend still decides who can be banned. Banning yourself, an admin, or another mod when you aren't an admin returns "You can't moderate this account."
- Account status link in Mod Tools moved inline. Each report card now has an underlined "Account status" link next to the reported username (e.g. PROFILE of @dummy  Account status). It shows on both open and reviewed cards.

  ### Notes
  - If a banned user is reactivated, their posts come back but the reports the ban closed stay closed.
  - A profile report's snapshot only keeps text (username, name and, where allowed, bio). The profile picture and banner aren't copied, so if they change before a mod looks, the report won't show the old images. Saving image evidence is on hold.
  - Not implemented yet: the other mod options in the profile ... menu (Remove profile picture, Remove banner, Remove left picture, Remove right picture) are still empty stubs.

## Notification sent to the reported user upon a Mod action 11/13 - RT
- Mod removals from Mod Tools, PostCard, PostPage, and UserPage now prompt for a message to the user, prefilled with a shared template.
- The reason is optional. If left blank, the message is sent as-is, ending in Reason:. Clearing the whole message or pressing Cancel aborts the removal.
- UserPage mod menu: Remove profile picture, banner, left picture, right picture, and bio are now wired to the backend.
- Notifications page renders the new content_removed notice: "Moderators removed your post", the message, and a "Removed: …" preview, with no profile link.
- Authors deleting their own content keep the original confirm() dialog.
- `utils/removalMessage.js`: 
  - REMOVAL_TEMPLATE: the single source for the prefilled message: "We have removed your content. Excessive violations will lead to account termination. Reason: "
  - askRemovalMessage(question, reason = ''): Shows a prompt() with the warning (question), a label noting that the reason is optional, and the template plus any prefilled reason.
- `pages/UserPage.jsx`: `removeProfileItem(item, label)` shared helper
  - Closes the ⋯ menu and prompts with askRemovalMessage(...)
  - POST /api/profile/`<username>`/remove-content/ with { items: [item], message }
  - On success, clears the removed fields locally (setPerson, setViewingUserCache), so the avatar, banner, bio, and side pictures update without a reload
  - Shows errors with alert(String(errorMessage(...)))
- `pages/Notifications.jsx` : Added removalText(n), which maps mod_action to text:
  - remove_post : "removed your post", remove_comment : "removed your comment, etc
  - Example notification of mod action type: 
    - "Moderators removed your comment · 2m New We have removed your content. Excessive violations will lead to account termination. Reason: spam Removed: the comment text"

## Mod log 11/14 - RT
- New Mod log section in the /mod sidebar. Lists every moderation action from GET /api/mod-log/
- `frontend/src/components/ModLog.jsx` (new):
  - ACTION_FILTERS: tab → backend actions. ACTION_STYLES: badge colors (unknown actions fall back to grey).
  - whoDidIt(entry): decides by source, not the text "Admin", so a mod with the username admin can't be confused with the admin site.
  - The first page reloads whenever a tab or the search changes. A cancelled flag drops slow old responses so they can't overwrite new results.
  - loadMore() skips entries already on screen (by id). If another mod acts while you read, entries shift down and page 2 would otherwise repeat a row. It also clears an old error once a load works.
  - Tabs and Search are disabled while Load more is running, so results from two filters can't mix.
- Background side pictures overlap detected when viewing mod page. Modified index.css and Layout.jsx to apply resize behaviour of these spaces specifically for /mod page.