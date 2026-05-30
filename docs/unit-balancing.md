# Unit balancing reference (index)

Canonical design data for Royal Armies combat and economy tuning. Use these documents as the source of truth when changing stats, costs, or rank rewards.

| Topic | Human-readable | JSON |
| --- | --- | --- |
| **PvP class opposition** | [pvp-class-opposition-matrix.md](./pvp-class-opposition-matrix.md) | [pvp-class-opposition-matrix.json](./pvp-class-opposition-matrix.json) |
| **Provisions progression** | [provisions-progression-curve.md](./provisions-progression-curve.md) | [provisions-progression-curve.json](./provisions-progression-curve.json) |

---

## Resource naming

| Legacy | Current |
| --- | --- |
| Grain | **Provisions** |

HUD and game copy should use **Provisions**. Ledger/API keys should prefer `provisions` where resources are stored.

---

## Quick reference

### PvP (8 classes)

Each PvP class counters **one physical** and **one magic** class. See the [PvP matrix](./pvp-class-opposition-matrix.md) for the full loop.

### Provisions (commander ranks 1–22)

- Start: **132** Provisions → **12** Tier 1 units @ 11 UPC  
- Ranks **2–21**: **+110** per rank → cap **2,332** at rank 21  
- Rank **22**: cap frozen; ~**42** elite units @ ~55 UPC  

See [provisions progression](./provisions-progression-curve.md) for phases (Start → Swarm → Pivot → Squeeze → End).

### Gold

- **Starting gold:** **20,000** (Rank 1 / new commander baseline for building and unit purchases).

### Move Points

- **Maximum:** **3** (hard cap; the HUD never exceeds this).
- **Regeneration:** **+1** move point per **Tick** (every **30 minutes** / half hour).
- **Display:** Current move points only (0–3) on the top HUD strip.
