# QuickBuckz Project
A simple social media website for UAA students.

## TODO
This is a list of items that we should implement into our project that anyone can update. Please mark items complete once they are finished.

- ~~Add password validators such as length requirement, character restrictions, at least one number, etc.. Currently passwords can be one character long which is weird.~~ - Done RT 10/08
- ~~Some sort of dashboard or frontpage where all posts can be displayed~~ - Done.
- ~~Create a website logo for Quickbuckz~~ - Done
- ~~/api/signup still only accepts username, email, and password. First name and last name should be included.~~ - Done RT 10/11
- ~~Implement Posts interaction logics (likes, comments, share) once there is a working user dashboard~~ - backend done RT
- ~~Show all posts in the /home page~~ - Done
- ~~Add API that can get user details with their username~~ - Done RT
- ~~Add API that can get all of a user's posts with their username~~ Done RT
- ~~Add functionality to /post-creation page~~

- Work on preserving login session by using cookies (adding more on token refresh mechanism) - in progress RT
- ~~Add more functionalities to Follow model: Current user viewing another profile can show “Follows you” (check login session/auth while viewing /api/profile/<username>/, then add field for 'follows_you' flag), shows if current user is following the profile being viewed, with follow/unfollow toggle (same logic, /api/profile/<username>/ would have field like 'is_followed'), mutual follows “followed by <users on your follow list>” (something like "/api/profile/<username>/mutuals")~~ - done backend
- ~~Implement share post functionality~~ - Done on the frontend MM (11/15): Share button copies the post's link. A Share model is only needed if we want share counts.
- ~~Implement fields or models for any additional personalized features from frontend (currently has ThemePicker)~~ - Done (theme + site_theme fields, 11/07)
- Touch on AccountSecurity backend design when a frontend design for account settings is drafted.
- ~~I think /api/posts should return more details about the author~~
    ~~- For example, the author field can return an object containing data about the user's username, first name, last name, and profile picture to display on each post.~~ Done

- Implement Notifications behaviour in frontend (testing Notifications model from backend) - in progress RT (10/25 implemented, might need more testing)
- ~~Be able to post comments on the frontend~~ - Done
- ~~Be able to like posts on the frontend~~ - Done JDN (10/30)
- ~~Be able to follow another user on their page~~ - Done MM (10/30)
- ~~Show a list of current followers on the follower page~~ - Done MM (10/30)


- ~~Report models up. TODO: api/reports/ , test report function, import changes in frontend~~ - Done (api/reports/ + Mod tools)
- ~~Add ability to report comments and users on their profile on the backend~~ - Done (11/13)
- ~~Add ability to ban users~~ - Done (ban list, ban/unban, status page, 11/09-11/13)
- ~~Clean up the setting menu - Mostly done MM (11/15): fake email/password forms replaced with "coming soon" notes until the backend endpoints exist~~ Changing emails and passwords is available in settings - Done JDN (11/18)
- ~~Store color theme in backend~~ - Done (11/07)
- ~~Block users~~ - Done (frontend MM 11/15, backend RT 11/19)
- ~~Deactivate your own account~~ - Done (backend RT 11/19, Settings button MM 11/21)
- ~~"Followed by ..." on profiles (mutuals endpoint)~~ - Done MM (11/21)

- Security fixes (added MM 11/15):
    - Remove the hardcoded fallback `SECRET_KEY` in settings.py (it should only come from the environment on Render)
    - ~~Forgot password/username: return the same response whether or not the email has an account (right now 404 vs "Sent email" tells people which emails are registered)~~ - Done JDN (11/18)
    - ~~Use `https://` (not `http://`) in the reset password email link, since the token is in the link~~ - Done JDN (11/18)

## TODO if we have extra time
- ~~Implement forgot password API. User sends email, the API returns a temporary token (5-10 minutes) to reset password.~~ - Done (emails the reset link, 11/14)
- ~~Implement reset password API. User sends new password with the forgot password token, API updates the new password.~~ - Done (11/14)
- ~~Implement reset password page for the frontend, the frontend takes in a token as a parameter and returns an error if the token is invalid or expired. This page is where the user gets to set their new password.~~ - Done
## Requested changes 11/22 - MM
- **Create account:** fields are now Email, Username, Password, Confirm password, then First and Last name.
- **Mods can deactivate accounts:** the mod "Ban" is now called **Deactivate** everywhere on the site (profile ⋯ menu "Deactivate (mod)", status page "Deactivate account", history). Same backend: it's still `POST/DELETE /api/profile/<username>/ban/`, and only a mod can reactivate it.
- **Mod tools > Deactivated** (was "Ban list"): every account a mod deactivated. Click one to see why and reactivate it. Self-deactivated accounts aren't listed. Mod log filter "Bans" is now "Deactivations".
