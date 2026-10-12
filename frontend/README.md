# Adored Vacation

React + Vite + Tailwind rebuild of the Framer design.

```bash
npm install
npm run dev
```

Pages done: `/login`, `/create-account` (placeholder).
To do: `/user-page`, `/top-content`, `/subscriptions`, `/user-account`, `/post-creation`.

## Login and Account Creator
- Added basic functionality to the /create-account and /login page
- /create-account creates a new account on the database.
- /login verifies if credentials fit in the database and redirects the user to a different page on success.

TODO:
- Test errors when creating and logging into an account e.g. username already exists, password fits criteria, credentials don't match...
- Ensure the appropriate messages appear when there is an error.
- Store access and refresh tokens securely and effectively.

UPDATES:
- Updated the /create-account page to display errors appropriately such as non-unique emails, non-unique usernames, invalid usernames, etc..
- Updated /create-account to include 'first-name' and 'last-name' in its POST JSON.stringify (modified firstName and lastName to match django User model variable names)
- Updated /create-account so that when a user register, they are automatically logged in with message "Account Created!". - RT 10/11
- Modified App.jsx by removing PublicRoute for /create-account, but also fixed the redirect logic where /create-account is still accessible with a login session (due to implementing above note). - RT 10/11


## Site Functionality
- /user-page now shows the logged in user's full name, bio, and username
- /user-page also shows the current user's posts
- for now, certain features of /user-page will be hidden such as likes, followers, and following as it is not implemented on the backend
