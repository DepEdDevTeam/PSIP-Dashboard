# PSIP Dashboard

The dashboard reads live Microsoft Fabric API for GraphQL data through a local
FastAPI service. Fabric access tokens and the GraphQL endpoint stay on the
backend and are never sent to the browser.

## Local setup

1. Copy `backend\.env.example` to `backend\.env` and set
   `GRAPH_QL_ENDPOINT` to the Fabric GraphQL endpoint. Keep
   `FABRIC_AUTH_MODE=interactive` for local development.
2. In `F:\Projects\PSIP-Dashboard\backend`, create the local environment,
   install dependencies, and start the API:

   ```powershell
   cd F:\Projects\PSIP-Dashboard\backend
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. Copy `site\.env.example` to `site\.env.local`. Add a public Mapbox token if
   the map should be enabled.
4. In `site`, install packages and start the dashboard:

   ```powershell
   bun install --frozen-lockfile
   bun run dev
   ```

The first data request opens Microsoft sign-in. The signed-in account needs
Fabric GraphQL “Run Queries and Mutations” permission and access to the backing
data source. After the first successful sign-in, the backend reuses the
encrypted Windows token cache and does not open another authentication tab on
every request or restart. The localhost callback tab can be closed after it
shows “Authentication complete.”

## Checks

```powershell
F:\Projects\PSIP-Dashboard\backend\.venv\Scripts\python.exe -m unittest -v test_fabric_service.py
cd site
bun run lint
bun run build
```

## Vercel deployment

Deploy only the `site` directory as the Vercel project root. The frontend is
configured with a Vercel-compatible Vinext build and proxies data requests to
the separate FastAPI service.

Set these Vercel environment variables:

```text
PSIP_API_BASE_URL=https://your-fastapi-service.example.com
PSIP_API_TIMEOUT_MS=120000
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk....
```

Deploy `backend` separately using the included `backend/Dockerfile`. Configure
the hosted API with `FABRIC_AUTH_MODE=default`, the Fabric GraphQL endpoint,
Azure service-principal credentials, and `CORS_ALLOWED_ORIGINS` containing the
Vercel domain. Interactive Microsoft sign-in and the local Windows token cache
are for local development only.
