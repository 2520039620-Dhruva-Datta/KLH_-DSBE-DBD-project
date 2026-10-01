# AMAP — Government Services Portal

Government Services Portal — Academic Prototype. The React frontend now uses the existing Express/MySQL backend.

From this folder (the one containing `package.json`), run:

```powershell
npm.cmd run dev
```

Open **http://127.0.0.1:5173** and keep the terminal running. For the compiled app on **http://localhost:3000**, run `npm.cmd run build` followed by `npm.cmd run dev:backend`.

- [Complete setup, accounts, routes and security guide](docs/live-portal-guide.md)
- [REST endpoint contract](docs/portal-api.md)
- [Project health and verification](docs/project-health.md)
- [Technical handoff](CLAUDE_HANDOFF.md)
- [Original frontend/API documentation (historical)](docs/legacy-frontend-and-api.md)

Existing local records were preserved. Identity functions use a synthetic sandbox, not UIDAI. See the guide for MFA, agent device approval, local recovery messages and limitations.
