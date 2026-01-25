# 🚭 SmokeLess — Local Smoking Tracker (v7)

**Fixes & Enhancements in v7**

- **Buttons not working (drag issue) — fixed**: Interactive elements inside draggable dashboard cards are now non-draggable and cancel drag events, so clicks/taps work reliably.
- **Savings Goal Progress Bar**: Set a goal in **Plan → Savings Goal** (amount + basis: *total* or *this month*). Dashboard **Money** card shows a progress bar and %.
- Everything from v6 retained: savings counter & badges, native notifications, movable cards, Log as default tab, craving intensity & notes, etc.

## Run
- Quick: open `index.html`.
- Recommended (PWA): `python -m http.server 5500` → open `http://localhost:5500/` → **Install app**.

## Notes
- For accurate savings, set **Cost per pack / Cigs per pack** in **Plan**.
- Use **Badges → Savings** to see milestone badges (₹100 .. ₹10,000).
