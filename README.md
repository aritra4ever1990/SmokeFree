# 🚭 SmokeLess — Local Smoking Tracker (v6)

**New in v6:**
1) **Savings counter & badges**
   - On each successful **craving timer completion**, we add the **price of 1 cigarette** to a **running savings total** (settings.cravingSavingsTotal).
   - New **Savings badges** (category: *savings*) at ₹100, ₹250, ₹500, ₹1,000, ₹2,000, ₹5,000, ₹10,000.
   - Money card shows **Craving savings (this month)** and **Total craving savings (to date)**.

2) **Native notifications** for timer milestones
   - Uses the **Notification API** (prompts once for permission).
   - Notifications at **Start**, **5:00 left**, **2:00 left**, and **Complete** (+ gentle vibration if supported).

3) **Movable dashboard cards**
   - Drag any card to **re‑order**; layout is persisted to **settings.cardOrder**.

4) **Log tab is the default**
   - App opens on **Log**.

5) **Craving intensity & note** (my helpful add‑on)
   - When starting a timer, optionally record **intensity (1–5)** and a quick **note**.
   - These appear in **History** alongside craving events and help you learn patterns.

Other highlights carried over:
- **Custom triggers** in **Plan → Triggers**.
- **Timer‑gated logging**, **Delay 5 min**.
- **30‑day line chart** & **Hours × Triggers** heatmap.
- **Streaks & Badges** (plus **Badges Gallery** with filter: All / Streaks / Timer / Savings).
- **Export/Import** JSON (entries, settings, badges) and CSV (now includes **type** and **action** columns).
- **PWA** ready; offline when served locally.

## ▶️ Run locally
- Quick: open `index.html`.
- Recommended (PWA): `python -m http.server 5500` → open `http://localhost:5500/` → **Install app**.

## Tips
- Set **Cost per pack** & **Cigs per pack** to get accurate savings and monthly money stats.
- Use **Badges → Savings** filter to see milestone badges as you progress.
- You can re‑order dashboard cards to keep your most‑used ones up top.

## License
MIT
