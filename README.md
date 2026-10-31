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
- Implement share post functionality: most likely will be a Share model to follow the current backend design
- Implement fields or models for any additional personalized features from frontend (currently has ThemePicker)
- Touch on AccountSecurity backend design when a frontend design for account settings is drafted.
- ~~I think /api/posts should return more details about the author~~
    ~~- For example, the author field can return an object containing data about the user's username, first name, last name, and profile picture to display on each post.~~ Done

- Implement Notifications behaviour in frontend (testing Notifications model from backend) - in progress RT (10/25 implemented, might need more testing)
- ~~Be able to post comments on the frontend~~ - Done
- ~~Be able to like posts on the frontend~~ - Done JDN (10/30)
- ~~Be able to follow another user on their page~~ - Done MM (10/30)
- ~~Show a list of current followers on the follower page~~ - Done MM (10/30)
- Create a fully working setting menu
- Report models up. TODO: api/reports/ , test report function, import changes in frontend - In progress RT
- maybe add being able to report profile as well, but for now, limit the action to sending a warning notification to the user reported when a moderator flags it