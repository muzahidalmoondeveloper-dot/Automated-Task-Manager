from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):
    APP_NAME: str = "Automated Task Manager"
    API_PREFIX: str = "/api"

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    BACKEND_BASE_URL: str = "https://automated-task-manager.onrender.com"
    FRONTEND_BASE_URL: str = "https://automated-task-manager.onrender.com"
    CORS_ORIGINS: str = "https://automated-task-manager.onrender.com"


    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None
    GOOGLE_SCOPES: list[str] = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.readonly",
    ]

    MICROSOFT_CLIENT_ID: str | None = None
    MICROSOFT_CLIENT_SECRET: str | None = None
    MICROSOFT_TENANT_ID: str = "common"
    MICROSOFT_REDIRECT_URI: str | None = None
    MICROSOFT_SCOPES: list[str] = [
        "offline_access",
        "openid",
        "profile",
        "email",
        "User.Read",
        "Mail.Read",
        "Calendars.Read",
        "OnlineMeetings.Read",
        "OnlineMeetingTranscript.Read.All",
    ]

    FRONTEND_URL: str = "http://localhost:5173"

    # Default admin seeded at startup
    ADMIN_NAME: str = "Admin"
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None


    # ── LLM provider selection ───────────────────────────────────────────────
    # Set LLM_PROVIDER to one of: ollama | openai | gemini | generic
    LLM_PROVIDER: str = "ollama"
    DEFAULT_MODEL: str | None = None

    # Ollama (default provider)
    OLLAMA_API_KEY: str | None = None
    OLLAMA_HOST: str = "https://ollama.com"
    OLLAMA_MODEL: str = "gpt-oss:120b"

    # OpenAI
    OPENAI_API_KEY: str | None = None

    # Google Gemini
    GEMINI_API_KEY: str | None = None

    # Generic OpenAI-compatible cloud model
    GENERIC_LLM_API_URL: str | None = None
    GENERIC_LLM_API_KEY: str | None = None

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "no-reply@example.com"
    SMTP_FROM_NAME: str = "Automated Task Manager"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()