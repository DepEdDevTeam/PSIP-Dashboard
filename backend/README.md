# PSIP FastAPI backend

This folder contains the Python service used by the PSIP Dashboard.

## Run locally

From PowerShell:

```powershell
cd F:\Projects\PSIP-Dashboard\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Keep that terminal open, then open `http://localhost:3000/dashboard`. Complete
Microsoft sign-in when prompted.

Useful endpoints:

- Health: `http://127.0.0.1:8000/health`
- API documentation: `http://127.0.0.1:8000/docs`

`main.py` is the server entry point. `test_graphql.py` is only an optional
command-line connection test. `test_db.py` is the older ODBC diagnostic and is
not used by the dashboard.

The first Fabric load fetches independent entities concurrently. Successful
datasets stay in memory for 30 minutes by default; restart the backend to clear
the cache. Configure this with `FABRIC_FETCH_WORKERS` and
`FABRIC_CACHE_SECONDS` in `.env`.

The landing page starts the dashboard preload on mount. Fabric uses four
concurrent entity workers and cursor pages of 500 rows by default (configure
`FABRIC_FETCH_WORKERS` and `FABRIC_PAGE_SIZE`). Cursor pages within each entity
remain sequential because each page needs the preceding cursor. Related tables
must finish before dashboard totals are assembled.

The browser keeps the completed dashboard in memory and IndexedDB for 30 minutes
from successful loading, including school records. Reloading or reopening the
same origin reuses IndexedDB. Expired or incompatible entries are refetched;
failed requests are not cached. If browser storage is unavailable, the current
page still uses memory. The dashboard retry bypasses the browser cache, while
the backend retains its independently configured cache. Preloading and navigation
share one request, and aborting a view does not cancel that shared preload.

Frontend cache regression checks: `cd site; node --test tests/psip-api.test.mjs`.
