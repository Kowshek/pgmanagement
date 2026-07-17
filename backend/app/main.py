from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.rate_limit import limiter

app = FastAPI(
    title="PG Management API",
    version="1.0.0",
    openapi_url="/openapi.json"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# The mobile app's web build (Expo web / `npm run web`) runs as a browser
# page hitting this API cross-origin, so it's subject to CORS — native
# iOS/Android builds are not. allow_origin_regex covers localhost/127.0.0.1
# on any port (Expo's web dev-server port varies by SDK/config), and
# cors_extra_origins lets a deployed web build add its real origin without
# a code change. No cookies are used (Bearer-token auth), so credentials
# don't need to be allowed.
extra_origins = [o.strip() for o in settings.cors_extra_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=extra_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
