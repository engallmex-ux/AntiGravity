import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

env_paths = [
    BASE_DIR / ".env",
    BASE_DIR / "gets_neovero_integration" / ".env",
    Path(r"C:\Users\Holter\.gemini\antigravity\scratch\gets_neovero_integration\.env")
]

for ep in env_paths:
    if ep.exists():
        load_dotenv(ep)
        break

GETS_BASE_URL = os.getenv("GETS_BASE_URL", "https://gets.ceb.unicamp.br/nec/")
GETS_USER = os.getenv("GETS_USER", "lucas.fonseca.4@hubrasil.gov.br")
GETS_PASS = os.getenv("GETS_PASS", "140921")

HISTORY_FILE = BASE_DIR / "analysis_history.json"
SCHEMA_OUTPUT = BASE_DIR / "gets_schema.json"
REPORT_OUTPUT = BASE_DIR / "mapa_mental.md"
DB_FILE = BASE_DIR / "gets_data.db"
