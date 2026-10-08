from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "todo_app"
    JWT_SECRET: str = "insecure-dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    FRONTEND_URL: str = "http://localhost:5173"

    # Google Gemini — the AI provider. When GEMINI_API_KEY is empty, the app
    # falls back to the built-in smart rule engine (no external calls).
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.7-flash"

    # Google OAuth (sign in with Google). When empty, the Google endpoint
    # answers 503 and the frontend hides the button.
    GOOGLE_CLIENT_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
