"""
Supervisor entrypoint — exposes the FastAPI app defined in main.py
as `server:app`, matching the /etc/supervisor/conf.d/*.conf config.
"""
from main import app  # noqa: F401

# Register the /api/prices/live endpoint + startup hook.
import live  # noqa: E402, F401
live.register(app)

# Register auth endpoints (Emergent-managed Google OAuth).
import auth  # noqa: E402, F401
auth.register(app)

# Register aggregated portfolio news endpoint (Yahoo Finance).
import news  # noqa: E402, F401
news.register(app)
