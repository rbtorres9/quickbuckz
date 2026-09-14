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

## Not Yet Covered (Upcoming)
- JWT authentication (login/signup endpoints via `djangorestframework-simplejwt`)
- Switching the database from SQLite to PostgreSQL
- Core social features (e.g. a `Post` model)
