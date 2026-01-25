# 🚭 SmokeLess — Local Smoking Tracker (v5)

**New in v5:**
- **Custom triggers moved to Plan** — manage triggers (add / delete / reorder) under **Plan → Triggers**; updates Log dropdown & chips.
- **Badges Gallery filter** — filter by **All / Streaks / Timer / Savings**.
- **Theme switch** — choose **System / Light / Dark** from the header.
- **Craving history** — timer events (start/pause/reset/delay/milestone/complete) are captured in **History**.
- **Savings boost** — each successful timer completion contributes to **Craving savings** in the **Money** card (current month).

Other highlights:
- **3‑month taper plan** with editable daily limits and optional quit date.
- **Timer‑gated logging** + **Delay 5 min**.
- **30‑day line chart** & **Hours × Triggers** heatmap (last 30 days).
- **Streaks & Badges** (plus persistent gallery).
- **Export/Import** JSON (entries, settings, badges) and CSV (now includes **type** and **action** columns).
- **PWA** ready; offline once served locally.

## ▶️ Run locally
- Quick: open `index.html`.
- Recommended (PWA): `python -m http.server 5500` → open `http://localhost:5500/` → **Install app**.

## Notes
- **Theme**: “System” respects your OS setting; “Light/Dark” overrides it.
- **Craving savings**: assumes the price of ~1 cigarette saved per successful timer; set **Cost per pack / Cigs per pack** in **Plan**.
- **CSV import**: legacy CSVs (without `type`) are treated as smoke entries.

## License
MIT
