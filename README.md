# 🚭 SmokeLess — v9 (AI Coach, daily check‑in, relapse repair, high‑risk nudges)

This build adds:
- **Reliability fix** for non‑working buttons (see *Troubleshooting*).
- **AI Coach** tab (via local Node proxy; offline fallback tips).
- **Daily check‑in** (configurable time, optional context to AI, micro‑goal suggestion).
- **Relapse repair template** (quick plan to bounce back; saved to History as a note).
- **Coach nudges** at your *high‑risk hours* (from your 30‑day heatmap).

## Run offline features
- Quick: open `index.html`.
- Recommended (PWA): `python -m http.server 5500` → open `http://localhost:5500/` → **Install app**.

## Enable the AI Coach (requires internet)
```bash
cp .env.example .env
# edit .env for Azure OpenAI (recommended) or OpenAI
npm install
npm start
# open http://localhost:8787/
```

## Troubleshooting buttons not clicking
- In v9 we ensure **interactive controls inside draggable cards** are non‑draggable and stop drag events. We also **delay app init until DOMContentLoaded** and added safer null checks.
- If you installed a previous PWA build, you may have cached files. **Hard refresh** (Ctrl/Cmd + Shift + R) or remove the old app, then open v9.
- As last resort: open DevTools → Console. If you see an error, share it and I’ll hot‑fix it.
