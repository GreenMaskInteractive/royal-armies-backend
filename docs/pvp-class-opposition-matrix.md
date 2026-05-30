# PvP class opposition matrix (locked-in)

Part of the [unit balancing reference](./unit-balancing.md).

Reference for **unit balancing** and combat resolution. This is the canonical logic loop governing PvP instances after duplicate-class bugs were ironed out and verified.

**Status:** Final, locked-in  
**Last captured:** 2026-05-27  
**Use:** Matchmaking advantage checks, counter-pick UX, damage modifiers, AI target priority, and balance spreadsheets.

---

## Matrix

| Selected PvP class | Opposes (physical) | Opposes (magic) | Ease-of-combat logic |
| --- | --- | --- | --- |
| **Physical Infantry** | Physical Cavalry | Magic Artillery | Braced lines stop horse charges / Can rush inside dead zones of rune cannons. |
| **Physical Cavalry** | Physical Artillery | Magic Infantry | Flanking speed cuts down ballista crews / Tramples casters before barriers go up. |
| **Physical Artillery** | Physical Beasts | Magic Cavalry | Heavy siege bolts pierce giant beasts / High-velocity iron drops flying/enchanted riders. |
| **Physical Beasts** | Physical Infantry | Magic Artillery | Raw feral mass crushes tightly packed foot blocks / Monsters trample backline batteries. |
| **Magic Infantry** | Physical Infantry | Magic Cavalry | AOE spells incinerate slow foot paths / Summoned gravity wells ground magic mounts. |
| **Magic Cavalry** | Physical Beasts | Magic Artillery | High-speed phase blinks easily kite slow beasts / Ethereal speed slips past rune grids. |
| **Magic Artillery** | Physical Cavalry | Magic Beasts | Tracking chain-lightning fries open cavalry arcs / Long-range beams target colossal dragons. |
| **Magic Beasts** | Physical Artillery | Magic Infantry | Anti-magic hide shrugs mechanical siege fire / Colossal size steps over static mage circles. |

---

## Class IDs (for code / data)

| Display name | Suggested `classId` |
| --- | --- |
| Physical Infantry | `physical_infantry` |
| Physical Cavalry | `physical_cavalry` |
| Physical Artillery | `physical_artillery` |
| Physical Beasts | `physical_beasts` |
| Magic Infantry | `magic_infantry` |
| Magic Cavalry | `magic_cavalry` |
| Magic Artillery | `magic_artillery` |
| Magic Beasts | `magic_beasts` |

---

## Opposition lookup (attacker → favored vs defender)

Each row’s **Opposes** columns mean the selected class has an ease-of-combat advantage against those defender classes.

| Attacker (`classId`) | Strong vs (`defenderClassId`) |
| --- | --- |
| `physical_infantry` | `physical_cavalry`, `magic_artillery` |
| `physical_cavalry` | `physical_artillery`, `magic_infantry` |
| `physical_artillery` | `physical_beasts`, `magic_cavalry` |
| `physical_beasts` | `physical_infantry`, `magic_artillery` |
| `magic_infantry` | `physical_infantry`, `magic_cavalry` |
| `magic_cavalry` | `physical_beasts`, `magic_artillery` |
| `magic_artillery` | `physical_cavalry`, `magic_beasts` |
| `magic_beasts` | `physical_artillery`, `magic_infantry` |

---

## Rules (for implementers)

1. **Eight classes only** — no duplicate-class entries in a single engagement roster.
2. **Two counters per class** — exactly one physical-affinity target and one magic-affinity target.
3. **Asymmetric rock-paper** — advantage is directional (A strong vs B does not imply B strong vs A).
4. **Balancing** — tune numeric modifiers (damage, mitigation, morale, initiative) against this matrix; do not change opposed pairs without updating this document and re-verifying the full loop.

---

## Machine-readable snapshot

See [`pvp-class-opposition-matrix.json`](./pvp-class-opposition-matrix.json) for the same data in JSON (import in scripts, sims, or NEXUS balance tools).
