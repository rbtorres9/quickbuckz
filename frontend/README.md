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
- !!! Before comitting, always change API_URL to quickbuckz.onrender.com and comment out the localhost link
