from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied

def enforce_csrf(request):
    def dummy_response(request):
        return None

    check = CSRFCheck(dummy_response)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})

    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        raw_token = None

        if header:
            raw_token = self.get_raw_token(header)
        elif request.COOKIES.get("access_token"):
            raw_token = self.get_raw_token(request.COOKIES.get("access_token"))

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)

        # Enforce CSFR protection when using cookie
        if header is None: 
            enforce_csrf(request)

        return self.get_user(validated_token), validated_token