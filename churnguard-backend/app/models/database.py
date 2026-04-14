import os
from pathlib import Path
import importlib

from supabase import Client, create_client

try:
    dotenv_module = importlib.import_module("dotenv")
    load_dotenv = getattr(dotenv_module, "load_dotenv", None)
except ImportError:
    load_dotenv = None


def _load_env_file(env_path: Path) -> None:
    if load_dotenv is not None:
        load_dotenv(dotenv_path=env_path)
        return

    if not env_path.exists():
        return

    # Minimal fallback loader when python-dotenv is unavailable.
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


# Load .env from backend root regardless of execution directory.
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
_load_env_file(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

missing_vars = [
    var_name
    for var_name, value in {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_KEY": SUPABASE_SERVICE_KEY,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
    }.items()
    if not value
]

if missing_vars:
    raise RuntimeError(
        f"Missing required Supabase env vars: {', '.join(missing_vars)}. "
        f"Expected them in {ENV_PATH}"
    )

# Service client: used by backend for database operations.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Anon client: used for auth operations.
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)