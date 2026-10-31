Profile update: first and last name are now editable

Endpoint: PATCH /api/profile/me/
Auth: Authorization: Bearer <access token>. You’ll get 401 without it.

Request: send only the fields you’re changing.

json
{ "first_name": "Ana", "last_name": "Reyes" }
Use PATCH, not PUT, so fields you leave out stay as they are.
Both fields are optional, with a max of 150 characters each.
To clear a name, send an empty string "". Don’t send null, because that returns a 400.
Leading and trailing spaces are trimmed on the server.
For uploads, these fields can go in the same multipart/form-data request as profile_picture / banner. Just formData.append('first_name', ...).

Response (200): the full owner profile, in the same shape as GET /api/profile/me/, with the new names. Use it to update local state instead of refetching.

Errors (400): keyed by field, for example:

json
{ "first_name": ["Ensure this field has no more than 150 characters."] }

Show these under the matching inputs.

UI to-do:

Add first name and last name inputs to the edit profile form, pre-filled from GET /api/profile/me/.
After saving, update anywhere the name is cached or displayed, like the navbar or the profile header. Public profile pages (/api/profile/<username>/), the profiles list and the follower/following lists will show the new name the next time they’re fetched.

Nothing else changes: response shapes are the same everywhere, and signup (POST /api/signup/) still takes first_name / last_name as before.