# Social Media App — Backend

## Setup on a New/Cloned Machine

0. **Check Python is installed**
   ```
   python --version
   ```
   Install Python first if missing, or if the version differs significantly from your main machine.

1. **Navigate into the project folder**

   **Windows:**
   ```
   cd path\to\cloned-repo
   ```
   **macOS/Linux:**
   ```
   cd path/to/cloned-repo
   ```

2. **Create and activate a new virtual environment**
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

3. **Install dependencies from requirements.txt**
   ```
   pip install -r requirements.txt
   ```

4. **Recreate your .env file**
   `.env` is gitignored and won't exist on the new machine. Manually recreate it with the same variable values (`SECRET_KEY`, database credentials, etc.)

   Here is a template to get going
   ```
   DATABASE_NAME="quickbucks_db"
   DATABASE_USER="postgres"
   DATABASE_PASS="password"
   DATABASE_HOST="localhost"
   DATABASE_PORT="8080"
   ```

5. **Run migrations and create a superuser**
   ```
   python manage.py migrate
   python manage.py createsuperuser
   ```

### Note on superuser accounts
Superuser accounts live inside `db.sqlite3`, which is gitignored and never committed. Cloning the repo only brings over code and migration files — not the database itself. Each machine gets its own local SQLite database, so you must run `createsuperuser` again on every new machine; it will be a separate account from the one on your original machine.

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

## Not Yet Covered (Upcoming)
- Write operations via the API (POST/PUT/DELETE — current views only support GET)
- JWT authentication (login/signup endpoints via `djangorestframework-simplejwt`)
- Switching the database from SQLite to PostgreSQL
