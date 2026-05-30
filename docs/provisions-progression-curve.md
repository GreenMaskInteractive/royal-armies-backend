# Compressed legacy provisions progression curve (locked-in)

Reference for **unit balancing**, roster caps, and commander rank rewards. Replaces legacy **Grain** naming — the live resource is **Provisions**.

**Status:** Final, locked-in  
**Last captured:** 2026-05-27  
**Machine-readable:** [`provisions-progression-curve.json`](./provisions-progression-curve.json)

---

## Core rules

| Rule | Value |
| --- | --- |
| **Rank 1 starting gold** | **20,000** Gold |
| **Rank 1 base pool** | **132** Provisions (exactly **12** Tier 1 infantry at **11 UPC** each) |
| **Rank-up payout** | **+110** Provisions per promotion (**Ranks 2–21** only) |
| **Rank 22 (max)** | **0** payout — cumulative cap **freezes at 2,332** |
| **Tier 1 reference cost** | **11 UPC** (unit provision cost) per infantry |
| **Endgame target** | ~**42** max-tier elite units (~**55 UPC** average) |

**Formula (ranks 1–21):** `cumulativeCap = 132 + (rank - 1) × 110`  
**Formula (rank 22+):** `cumulativeCap = 2332`

---

## Progression table

| Commander ranks | Provisions per rank | Cumulative cap | Max Tier 1 capacity (11 UPC) | Strategic phase & player loop |
| --- | --- | --- | --- | --- |
| **Rank 1** | 132 (base) | 132 | 12 units | **The Start:** Tight initial roster split between PvP and Rank drop units. |
| **Ranks 2 – 6** | +110 per rank | 242 → 682 | 22 → 62 units | **The Swarm:** Roster swells horizontally. Players buy alternative counter classes. |
| **Ranks 7 – 9** | +110 per rank | 792 → 1,012 | *Recruiting stops* | **The Pivot:** Training battles get too hard for Tier 1. Buying ends; promotion begins. |
| **Ranks 10 – 21** | +110 per rank | 1,122 → 2,332 | *Roster shrinks* | **The Squeeze:** Steady flat rewards. Must dismiss Tier 1 swarms to afford elite upgrades. |
| **Rank 22 (max)** | 0 (stops) | 2,332 | *Final elite squad* | **The End:** Permanent freeze. Barracks hold ~42 max-tier elite units (55 UPC average). |

---

## Phase IDs (for code / UX)

| Phase | Ranks | `phaseId` |
| --- | --- | --- |
| The Start | 1 | `the_start` |
| The Swarm | 2–6 | `the_swarm` |
| The Pivot | 7–9 | `the_pivot` |
| The Squeeze | 10–21 | `the_squeeze` |
| The End | 22 | `the_end` |

---

## Balancing notes

- Tune unit **UPC** (unit provision cost) and promotion costs against cumulative caps — do not change rank payouts without updating this document.
- After **rank 7**, horizontal Tier 1 recruiting should be disabled; progression shifts to promotion / elite upgrades.
- **Rank 22** is a hard cap: no further provision inflation; design around ~42 high-tier roster slots.
