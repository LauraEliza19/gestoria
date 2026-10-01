from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

from app.config import settings


class SecurityMiddleware:
    """Same-origin JSON API: custom CSRF header required on every mutation.

    Do not add permissive CORS. The header is deliberately not an authentication
    credential; browsers cannot send it cross-origin without a CORS preflight.
    """

    def __init__(self, app):
        self.app = app

    def __getattr__(self, name):
        return getattr(self.app, name)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)

        async def secure_send(message):
            if message["type"] == "http.response.start":
                out = MutableHeaders(scope=message)
                out["X-Content-Type-Options"] = "nosniff"
                out["X-Frame-Options"] = "DENY"
                out["Referrer-Policy"] = "strict-origin-when-cross-origin"
                out["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
                out["Content-Security-Policy"] = (
                    "default-src 'self'; script-src 'self'; "
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; "
                    "connect-src 'self'; object-src 'none'; base-uri 'self'; "
                    "frame-ancestors 'none'; form-action 'self'"
                )
                if settings.app_env != "production" and scope["path"] in {
                    "/docs",
                    "/redoc",
                    "/docs/oauth2-redirect",
                }:
                    out["Content-Security-Policy"] = (
                        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://fastapi.tiangolo.com; "
                        "connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
                    )
                if scope["path"].startswith("/api/") or "text/html" in out.get(
                    "content-type", ""
                ):
                    out["Cache-Control"] = "no-store"
                if settings.app_env == "production":
                    out["Strict-Transport-Security"] = "max-age=31536000"
            await send(message)

        if settings.app_env == "production" and scope.get("scheme") != "https":
            response = JSONResponse({"detail": "HTTPS obrigatório."}, status_code=400)
            return await response(scope, receive, secure_send)
        if scope["path"].startswith("/api/") and scope["method"] not in {
            "GET",
            "HEAD",
            "OPTIONS",
        }:
            origin = headers.get("origin")
            if (
                headers.get("x-csrf-protection") != "1"
                or headers.get("sec-fetch-site") == "cross-site"
                or (origin is not None and origin not in settings.allowed_origins)
            ):
                response = JSONResponse(
                    {"detail": "Origem ou proteção CSRF inválida."}, status_code=403
                )
                return await response(scope, receive, secure_send)
        await self.app(scope, receive, secure_send)
