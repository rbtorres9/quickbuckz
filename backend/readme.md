# Social Media App — Backend

## Setup on a New/Cloned Machine

1. **Check Python is installed**
   ```
   python --version
   ```
   Install Python first if missing, or if the version differs significantly from your main machine.

2. **Navigate into the project folder**

   **Windows:**
   ```
   cd path\to\cloned-repo
   ```
   **macOS/Linux:**
   ```
   cd path/to/cloned-repo
   ```

3. **Create and activate a new virtual environment**
   ```
   python -m venv venv
   ```

   Then activate it:

   **PowerShell (Windows):**
   ```
   venv\Scripts\Activate.ps1
   ```
   If PowerShell blocks the script, run once:
   ```
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

   **Command Prompt (Windows):**
   ```
   venv\Scripts\activate.bat
   ```

   **macOS/Linux:**
   ```
   source venv/bin/activate
   ```

4. **Install dependencies from requirements.txt**
   ```
   pip install -r requirements.txt
   ```

5. **Get the shared `.env` file**
   `.env` is gitignored and won't exist on a fresh clone. Since the team now shares one Neon database and one Render deployment, don't fill this in with placeholder values — get the real, current `.env` contents from a teammate (or wherever the team is sharing it) and drop it into the project root as-is. Using different or made-up values here will point your local server at the wrong database, or nothing at all.

6. **Run migrations and create a superuser**
   ```
   python manage.py migrate
   python manage.py createsuperuser
   ```
   Since `.env` now points at the shared Neon database, `migrate` won't create a new database — it's confirming your machine is in sync with the existing one. Only run `createsuperuser` if you don't already have an account on the shared database (check with the team first, to avoid creating a duplicate).

### Note on superuser accounts
This note is now outdated for the shared-database setup and kept only for history: it originally described SQLite, where each machine had its own separate local database file, so `createsuperuser` had to be run fresh on every machine. Now that the team shares one Neon database (see step 5), superuser accounts are shared too — an account created by one teammate is visible to everyone. Check with the team before running `createsuperuser` again to avoid creating duplicate accounts.

---

# Django Topics Covered — Social Media App Backend

A running summary of Django/backend concepts covered in the walkthrough so far.

## 1. Project & Environment Setup
- Created a virtual environment (`python -m venv venv`) and activated it
- Installed core packages: `django`, `djangorestframework`, `psycopg2-binary`, `djangorestframework-simplejwt`, `Pillow`
- Generated the project with `django-admin startproject config .`
- Ran the dev server with `python manage.py runserver` and confirmed the install page

## 2. Project Structure
- `manage.py` — command-line entry point for all Django management commands
- `config/settings.py` — project-wide configuration (installed apps, database, middleware)
- `config/urls.py` — root URL routing table
- `config/wsgi.py` / `asgi.py` — deployment entry points

## 3. Apps
- Created the `accounts` app with `python manage.py startapp accounts`
- Covered the standard app file layout: `models.py`, `views.py`, `admin.py`, `apps.py`, `tests.py`, `migrations/`
- Registered the app (and `rest_framework`) in `INSTALLED_APPS` in `settings.py`

## 4. Models
- Modeled `Profile` as a Django model class, connecting it to the concept of a plain Python class
- Used `models.OneToOneField(User, on_delete=models.CASCADE)` to attach a `Profile` to Django's built-in `User` model rather than subclassing `User` directly
- Covered field types: `CharField`, `TextField`, `EmailField`, `ImageField`, `DateTimeField(auto_now_add=True)`
- Covered `blank=True` / `null=True` for optional fields

## 5. Migrations
- `python manage.py makemigrations <app>` — generates migration files describing schema changes
- `python manage.py migrate` — applies migrations to the database
- `python manage.py showmigrations` — lists applied vs. pending migrations

## 6. Django Admin
- Registered `Profile` in `accounts/admin.py` via `admin.site.register(Profile)`
- Created a superuser with `python manage.py createsuperuser`
- Used the admin UI to view/add `User` and `Profile` records and confirm the data layer works end-to-end

## 7. Signals
- Covered the observer/callback pattern in plain Python (a `listeners` list + `fire_event()`) as a conceptual bridge to Django signals
- Implemented `post_save` signal on the `User` model to auto-create a `Profile` whenever a new `User` is saved:
  ```python
  @receiver(post_save, sender=User)
  def create_profile(sender, instance, created, **kwargs):
      if created:
          Profile.objects.create(user=instance)
  ```
- Wired the signal into the app via `AccountsConfig.ready()` in `apps.py`, which imports `accounts.signals` so the `@receiver` registration actually runs
- Verified: creating a `User` in the admin now auto-creates a matching `Profile` with no manual step

## 8. Serializers
- Covered the "object → dict → JSON" conversion pattern in plain Python (`book_to_dict()` + `json.dumps()`) as a conceptual bridge to DRF serializers
- Wrote `ProfileSerializer` in `accounts/serializers.py` using DRF's `ModelSerializer`:
  ```python
  class ProfileSerializer(serializers.ModelSerializer):
      class Meta:
          model = Profile
          fields = ['id', 'user', 'bio', 'profile_picture', 'created_at']
  ```
- Covered how `ModelSerializer` auto-generates the object-to-dict conversion based on the model's fields, and how `Meta.fields` controls which fields are included

## 9. Views
- Covered the "function in, response out" pattern in plain Python (a `handle_request()` function branching on input) as a conceptual bridge to DRF views
- Wrote `ProfileListView` in `accounts/views.py` using DRF's `generics.ListAPIView`:
  ```python
  class ProfileListView(generics.ListAPIView):
      queryset = Profile.objects.all()
      serializer_class = ProfileSerializer
  ```
- Covered how `queryset` supplies the data and `serializer_class` converts it to JSON, mirroring the warm-up's data + conversion split

## 10. URL Routing
- Covered URL routing as a path-to-function lookup table in plain Python (a `routes` dict + `handle_path()`) as a conceptual bridge to Django's URL system
- Created `accounts/urls.py` (app-level routes) and used `include()` in `config/urls.py` to nest app routes under the project's root routes
- Verified: `http://127.0.0.1:8000/api/profiles/` returns live `Profile` data as JSON via DRF's browsable API

## 11. A Second Model: `Post` (ForeignKey relationships)
- Covered the "one-to-many" relationship in plain Python (an `Author` with a `posts` list) as a conceptual bridge to `ForeignKey`
- Wrote the `Post` model in `accounts/models.py`, introducing `ForeignKey` (many `Post`s per `User`) as distinct from the `OneToOneField` used for `Profile`:
  ```python
  class Post(models.Model):
      author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
      content = models.TextField()
      image = models.ImageField(upload_to='posts/', blank=True, null=True)
      created_at = models.DateTimeField(auto_now_add=True)
      updated_at = models.DateTimeField(auto_now=True)
  ```
- Covered `related_name` (enables `some_user.posts.all()`) and `auto_now` vs. `auto_now_add`
- Ran `makemigrations` / `migrate` for `Post`, same cycle as `Profile`

## 12. Applying Serializers, Views, and URLs to `Post`
- Wrote `PostSerializer` in `accounts/serializers.py`, and used `serializers.ReadOnlyField(source='author.username')` to show the author's username instead of their raw ID
- Wrote `PostListView` in `accounts/views.py` using `generics.ListAPIView`, same pattern as `ProfileListView`
- Added a `posts/` route in `accounts/urls.py`
- Registered `Post` in `accounts/admin.py` (`admin.site.register(Post)`) so test posts can be created via the admin UI
- Verified: created a test `Post` via the admin, and `http://127.0.0.1:8000/api/posts/` returned it as live JSON with the author's username

## 13. Environment-Based Database Config
- Introduced `django-environ` to read database settings from a `.env` file instead of hardcoding them in `settings.py`
- Added fallback logic so the project uses SQLite locally when no Postgres `.env` values are present, and switches to Postgres automatically once real credentials are supplied:
  ```python
  if env('DATABASE_HOST', default=None):
      DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', ...}}
  else:
      DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
  ```
- Covered a gotcha: any string value in `.env` (even a placeholder like `"localhost"`) counts as "present" and triggers the Postgres branch — `.env` needs to omit `DATABASE_HOST` entirely (not just leave it blank) to fall through to SQLite
- Each teammate needs their own local `.env` file (gitignored) after cloning

## 14. Config Fix: Email Backend
- Caught and fixed an invalid setting: `MAILERS = {...}` isn't a real Django setting and was silently doing nothing
- Corrected to the actual setting name:
  ```python
  EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
  ```
- Prints emails to the console for now (useful later for signup confirmations, password resets)

## 15. JWT Authentication: Login
- Covered the token/signature concept in plain Python (a `hashlib`-based `issue_token`/`verify_token` pair) as a conceptual bridge to JWT
- Added `TokenObtainPairView` (login) and `TokenRefreshView` (refresh an expired access token) from `djangorestframework-simplejwt` to `accounts/urls.py`
- Set `DEFAULT_AUTHENTICATION_CLASSES` to `JWTAuthentication` in `config/settings.py`
- Verified: `POST /api/token/` with a valid username/password returns real `access` and `refresh` JWT tokens

## 16. JWT Authentication: Signup
- Applied the serializer → view → URL pattern a third time, this time for registration
- Wrote `RegisterSerializer` in `accounts/serializers.py` using `write_only=True` on the password field (so it's accepted on input but never returned in a response) and `User.objects.create_user(...)` (which hashes the password, unlike a plain `.create()`)
- Wrote `RegisterView` using `generics.CreateAPIView` (handles POST, not GET, unlike the earlier List views)
- Added a `signup/` route in `accounts/urls.py`
- Verified: `POST /api/signup/` with a new username/email/password returns `201 Created` with the new user's data (password omitted), and the `post_save` signal correctly auto-created a `Profile` for the new user

## 17. Write Operations: Creating Posts
- Covered "trust server-side identity, not client input" in plain Python (`create_post` vs. `create_post_safe`) as a conceptual bridge to `perform_create`
- Upgraded `PostListView` from `ListAPIView` to `ListCreateAPIView` (handles both GET and POST on the same URL)
- Added `permission_classes = [IsAuthenticated]` so anonymous requests are rejected
- Overrode `perform_create` to force `author=self.request.user`, so the author always comes from the JWT, never from the request body
- Verified with `Invoke-WebRequest`: an authenticated POST creates a post correctly attributed to the logged-in user; an unauthenticated POST is rejected with `401`; and a spoofed `"author"` value in the request body is silently ignored in favor of the real logged-in user

## 18. Write Operations: Updating a Profile
- Covered "look up my own record, not any record" in plain Python (`update_my_profile(current_user, ...)`) as a conceptual bridge to `get_object`
- Decided against a generic `POST` for `Profile` (redundant, since every `User` already gets one via the signal, and `OneToOneField` blocks a second one) — built an update-only endpoint instead
- Wrote `MyProfileView` using `generics.RetrieveUpdateAPIView` (GET + PUT/PATCH, no POST/DELETE), overriding `get_object()` to always return `self.request.user.profile` — no ID in the URL, so there's nothing for a client to fake
- Added a `profile/me/` route in `accounts/urls.py`
- Verified: `PATCH /api/profile/me/` with a JWT updates the logged-in user's own bio, scoped correctly with no ID needed

## 19. CORS Setup for the Framer Frontend
- Installed `django-cors-headers` so browsers allow cross-origin requests from Framer's domain (Framer hosts the frontend separately from where Django runs, and browsers block cross-origin calls by default)
- Added `corsheaders` to `INSTALLED_APPS` and `CorsMiddleware` to `MIDDLEWARE` in `config/settings.py`, placed near the top (before `CommonMiddleware`), since middleware order matters
- Added `CORS_ALLOWED_ORIGINS` with a placeholder for Framer's local preview (`http://localhost:3000`), to be updated with the real published Framer URL once available
- Verified the server boots cleanly with the new middleware in place; full verification (an actual cross-origin request from Framer) is pending the teammate's Framer setup

## 20. Switching to Shared PostgreSQL (Neon)
- Compared free Postgres hosts (Neon, Supabase, Aiven, Render) against the project's needs — settled on Neon for its narrower scope (just a database, no unused auth/storage platform features, since JWT auth is already custom-built)
- Created a Neon project and pulled the connection string apart into the five `.env` values the existing `django-environ` fallback logic already expected (`DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASS`, `DATABASE_HOST`, `DATABASE_PORT`) — no code changes needed to switch providers, since the fallback logic was written generically
- Used Neon's pooled connection host (`-pooler` in the hostname) rather than the direct one, better suited to a web app's many short-lived connections
- Added `sslmode` and `channel_binding` to `DATABASES['default']['OPTIONS']`, required by Neon
- Verified: `migrate` applied all migrations to the fresh Neon database, `createsuperuser` succeeded, and the account is visible in the admin panel — confirming the whole team is now able to point at one shared live database instead of separate local SQLite files

## 21. Production Settings for Deployment
- Made `SECRET_KEY`, `DEBUG`, and `ALLOWED_HOSTS` environment-driven via `env(...)` (same `django-environ` pattern as the database config), instead of hardcoded
- Fixed an ordering bug: `env = environ.Env()` / `read_env(...)` must run before any setting calls `env(...)` — moved that setup to the top of `settings.py`, right after `BASE_DIR`
- Added `gunicorn` (production web server) and `whitenoise` (serves static files directly from Django) to `requirements.txt`
- Added `WhiteNoiseMiddleware` to `MIDDLEWARE` and configured `STATIC_ROOT` / `STORAGES` for compressed static file serving

## 22. Deploying to Render
- Added a `Procfile` (`web: gunicorn config.wsgi --log-file -`) telling Render how to start the app
- Added `build.sh` to install dependencies, run `collectstatic`, and run `migrate` automatically on each deploy
- Added a `.gitattributes` entry (`build.sh text eol=lf`) to prevent Windows CRLF line endings from breaking the script on Render's Linux environment
- Created the Render Web Service, connected to GitHub, with Build Command `./build.sh` and Start Command `gunicorn config.wsgi`
- Set environment variables on Render's dashboard (Environment tab) — `SECRET_KEY` (freshly generated, not the scaffolded default), `DEBUG=False`, `ALLOWED_HOSTS`, and the same `DATABASE_*` values used locally for Neon
- Caught and fixed a typo (`DATABASE` instead of `DATABASE_NAME`) that caused the first deploy to fail with `KeyError: 'DATABASE_NAME'`
- Live at `https://quickbuckz.onrender.com`, connected to the same shared Neon database as local development

## 23. Bug Fix: Public Reads vs. Authenticated Writes
- Caught a bug surfaced by the live deploy: `PostListView` had `permission_classes = [IsAuthenticated]`, which blocked **both** GET and POST — but the intent (and what the frontend API reference already documented) was public reads, authenticated writes only
- Fixed by switching to `IsAuthenticatedOrReadOnly`, DRF's built-in permission for that exact split (GET/HEAD/OPTIONS open to anyone, POST/PUT/PATCH/DELETE require a valid JWT)
- Confirmed `ProfileListView` (never had `permission_classes` set, so already public) and `MyProfileView` (should always require auth) were correctly left unchanged — only `PostListView` needed the fix

## 24. Root Landing Page
- Added a plain function-based view (`home`) in `config/urls.py`, registered at the root path `''`, returning a simple `HttpResponse` — the API-only backend previously 404'd at `/`, which is otherwise expected/normal but was worth a friendly landing message instead

## 25. Added Backend Storage
- Updated backends/config/settings.py so files can be stored in the neon database using S3 API
- Changed Post model to be uploaded to a slightly different location

## Not Yet Covered (Upcoming)
- Sharing the real `.env` values with the rest of the team so everyone points at the same Neon database instead of their own local SQLite
- Adding the real Framer published URL to `CORS_ALLOWED_ORIGINS` once available
- JWT handling on the Framer frontend side (storing tokens, attaching them to fetch calls, refreshing on expiry)
