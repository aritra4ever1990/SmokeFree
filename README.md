# 🚭 SmokeLess — Local Smoking Tracker (v2)

A lightweight, privacy‑first web app to log cigarettes, visualize trends, and follow a simple 3‑month taper plan to quit — now with **Craving Timer**, **Streaks & Badges**, and **Charts**.

- **No backend, no sign‑up** — data stays in your browser (localStorage).
- **Plan** — generate a 90‑day taper to 0 (or set your quit date).
- **Dashboard** — today’s total, 7‑day sparkline, money stats.
- **NEW:** **Craving Timer** (10 minutes with rotating tips).
- **NEW:** **Streaks & Badges** (within‑limit, zero‑day, weekly improvements).
- **NEW:** **Charts** — 30‑day line chart & triggers heatmap (native Canvas, no libs).
- **History** — review and delete entries.
- **Export/Import** — JSON/CSV with merge & de‑dup by id.
- **PWA** — installable; works offline when served locally.

## ▶️ Run locally
**Option A (quickest):**
- Open `index.html` directly in your browser (no install prompt; still works).

**Option B (recommended):**
- From `smoking-tracker` folder, run a local server:
  - Python 3: `python -m http.server 5500`
  - Node: `npx http-server -p 5500`
- Visit `http://localhost:5500/` and choose **Install app**.

## 💡 Feature details
### Craving Timer
- 10‑minute countdown with **Start / Pause / Reset**.
- Saves state so a reload won’t lose progress.
- Rotating tips to ride out cravings.

### Streaks & Badges
- **Within‑limit streak** (only counts days where a limit exists).
- **Zero‑day streak** (days with 0 total).
- **Weekly change** compares last 7 days vs previous 7 days.
- Earn badges like *First day within limit*, *3‑day within‑limit*, *7‑day within‑limit*, *First zero‑day*, *72 hours clear*, *20% weekly drop*.

### Charts
- **30‑Day Line Chart:** Daily counts (blue) with daily limit overlay (gray, dashed).
- **Triggers Heatmap:** Rows = triggers; columns = days of week (Mon → Sun); darker cells = more logs in the last 30 days.

## 🔒 Privacy
All data is local. Export regularly if you plan to clear browser storage.

## 🛠️ Customization ideas
- Add notifications/reminders for times you typically log.
- Add a “Delay 5 minutes” quick‑action on the timer.
- Add a trigger editor to customize the list.

## 📄 License
MIT
