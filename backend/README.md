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
