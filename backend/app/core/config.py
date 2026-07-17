from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30
    redis_url: str
    # Comma-separated list of extra allowed origins for local/dev tooling
    # (e.g. a deployed web build). localhost/127.0.0.1 on any port is
    # always allowed via regex below, independent of this setting — that
    # covers Expo web, whose dev-server port varies (8081, 19006, ...).
    cors_extra_origins: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
