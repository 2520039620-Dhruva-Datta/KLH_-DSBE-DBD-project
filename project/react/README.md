# AMAP React frontend

The default mode is now **live**, backed by the original Express/MySQL database through `/api/portal`.

Run `npm.cmd run dev` from the parent **Government Analytics Portal** directory to start the database, backend and Vite together, then open http://127.0.0.1:5173. Running Vite alone requires an already-running backend on port 3000.

See the [current run guide](../docs/live-portal-guide.md) and [technical handoff](../CLAUDE_HANDOFF.md). The [archived React demo guide](docs/archived-react-demo-guide.md) describes the earlier browser-only 6,006-row dataset. That dataset is preserved for explicit `VITE_API_MODE=demo`; it is not loaded or migrated in default live mode.
