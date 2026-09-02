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
   npm install
   npm run dev
   ```

The first data request opens Microsoft sign-in. The signed-in account needs
Fabric GraphQL “Run Queries and Mutations” permission and access to the backing
data source.

## Checks

```powershell
F:\Projects\PSIP-Dashboard\backend\.venv\Scripts\python.exe -m unittest -v test_fabric_service.py
cd site
npm run lint
npm run build
```

For hosted use, deploy FastAPI separately, use managed identity or a service
principal (`FABRIC_AUTH_MODE=default`), and set `PSIP_API_BASE_URL` to its HTTPS
origin in the Sites runtime configuration.
