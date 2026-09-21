from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/voters"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 24 * 60
    cookie_secure: bool = False  # প্রোডাকশনে অবশ্যই True (Railway env var দিয়ে সেট হবে)
    admin_bootstrap_username: str = "admin"
    admin_bootstrap_password: str = "change-me-immediately"
    convert_output_dir: str = "~/Desktop"  # PDF কনভার্সনের Excel ব্যাকআপ এখানে সেভ হয়


settings = Settings()
