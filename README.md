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
- Add more functionalities to Follow model: Current user viewing another profile can show “Follows you” (check login session/auth while viewing /api/profile/<username>/, then add field for 'follows_you' flag), shows if current user is following the profile being viewed, with follow/unfollow toggle (same logic, /api/profile/<username>/ would have field like 'is_followed'), mutual follows “followed by <users on your follow list>” (something like "/api/profile/<username>/mutuals")
- Implement share post functionality: most likely will be a Share model to follow the current backend design
- Implement fields or models for any additional personalized features from frontend (currently has ThemePicker)
- Touch on AccountSecurity backend design when a frontend design for account settings is drafted.
