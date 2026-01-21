# 🚭 SmokeLess — Local Smoking Tracker (v3)

Now includes **Delay 5 minutes**, **Persistent Badges Gallery**, **Hours × Triggers heatmap**, and **Timer‑gated logging**.

- **No backend, no sign‑up** — data stays local (localStorage).
- **Plan** — 90‑day taper to 0 (or quit date) + **Craving timer duration**.
- **Dashboard** — today’s total & remaining vs limit, sparkline, money., **Craving Timer** with **Delay 5 min**.
- **Charts** — 30‑day line chart & **hours × triggers** heatmap.
- **Streaks & Badges** — live streaks + **persistent gallery**.
- **Export/Import** — JSON/CSV (badges also exported).
- **PWA** — installable; offline when served locally.

## ▶️ Run locally
- Quick: open `index.html` directly.
- Recommended (PWA): in folder run `python -m http.server 5500` → open `http://localhost:5500/` → **Install app**.

## 🆕 v3 details
### Craving Timer
- **Start / Delay 5 min / Pause / Reset**.
- When **running**, **logging is disabled** (Quick Log and Save are disabled and attempts are blocked).
- On **completion**, you **earn a badge** and see the **price of 1 cigarette saved** (uses **Cost per pack / Cigs per pack** from Plan).
- Default duration is set in **Plan → Craving timer (minutes)**.

### Badges
- **Live** badges shown under *Streaks & Badges*.
- **Persistent** badges saved and displayed in *Badges Gallery*.

### Heatmap
- **Hours × Triggers** (0–23 × triggers) for the **last 30 days**. Darker = more logs.

## 🔒 Privacy
All data (entries, settings, badges) is stored locally.

## 🛠️ Tips
- Set **Cost per pack** and **Cigs per pack** in Plan for money stats & timer savings.
- Export JSON periodically as a backup.

## 📄 License
MIT
