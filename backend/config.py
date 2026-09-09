import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite+aiosqlite:///./data/flood_prediction.db"
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    USE_REDIS: bool = os.getenv("USE_REDIS", "false").lower() == "true"
    
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "demo")
    OPENMETEO_BASE_URL: str = os.getenv("OPENMETEO_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    ALERT_SIMULATION_MODE: bool = os.getenv("ALERT_SIMULATION_MODE", "true").lower() == "true"
    
    DEFAULT_REGION: str = os.getenv("DEFAULT_REGION", "Chamoli_Valley_Uttarakhand")
    SIMULATOR_TICK_SECONDS: int = int(os.getenv("SIMULATOR_TICK_SECONDS", 5))
    STORM_RAMP_MINUTES: int = int(os.getenv("STORM_RAMP_MINUTES", 3))

settings = Settings()
