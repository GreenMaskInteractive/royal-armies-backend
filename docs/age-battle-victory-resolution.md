# Age battle victory resolution — AI reference

**Purpose:** Canonical description of how Royal Armies **Age** battles decide a victor. Use this when implementing, debugging, or extending guild training, city assault, army-group assault, or watchtower border PvP.

**Authoritative implementation:** `nexus-age-battle-sim.js` + `nexus-age-battle-modifiers.js` (NEXUS layer).

**Last aligned to code:** June 2026 (phase-linking refactor).

---

## Scope

### Uses this system

| Feature | Entry module | Mode string | Attacker | Defender |
|--------|--------------|-------------|----------|----------|
| Guild training spar | `nexus-age-guild.js` → `executeGuildTrainingBattle` | `street-patrol`, `civilian-transport`, `border-patrol` | Commander healthy stacks | Scaled training NPC roster |
| City assault (solo) | `nexus-age-city-battle.js` → `executeCityAssaultBattle` | `city-assault` | Commander healthy stacks | City garrison (tier + ally scaled) |
| Army group assault | `nexus-age-army-group-battle.js` | `city-assault` (via guild wrapper) | Combined member armies | Same garrison logic |
| Watchtower border seize | `nexus-age-watchtower.js` | `border-pvp` | Attacker stacks | Defender stacks |

All paths converge on **`simulateTrainingBattle(attackerStacks, defenderStacks, catalog, trainingMode)`**.

### Does NOT use this system

- **`public/battle-engine.js`** — legacy strike-force vs city HP model (ranged → cavalry → 8-round grind; `cityHP <= 0` = capture). Separate code path; do not confuse with Age battles.
- **Casualty risk UI** (`nexus-age-border-assault-casualty.js`) — injury/death **ranges** for assault commitment; not victory odds.

---

## Design intent

Battles are **deterministic** given:

- Unit catalog stats (`public/data/unit-purchase-catalog.json`)
- Stack quantities, ranks, and promotion tier keys
- PvP class opposition matrix (`docs/pvp-class-opposition-matrix.json`)

There is **no combat RNG** inside `simulateTrainingBattle` (damage rolls, hit chance, etc.). NPC **roster composition** for training can be randomized when building the host army (`buildRandomizedTrainingHostStacks`), but once stacks are fixed the battle outcome is fixed.

**Victory conditions (product rule):**

1. **Annihilation** — opponent reaches 0 HP or 0 units.
2. **Routing** — opponent morale collapses or takes unsustainable casualties.
3. **Infantry phase decision** — if neither side breaks, higher remaining HP wins after phases complete.
4. **Draw** — mutual rout with equal HP, or stalemate with equal HP after infantry.

Class perks (Battlemaster / Battlemage), banner branches, battle gear, composition archetype bonuses, and settlement defenses are applied via **`nexus-age-battle-modifiers.js`** when `battleOptions` includes commander ledger context **and** `disableCombatModifiers` is not set.

### Guild training exception

Guild training spars (`executeGuildTrainingBattle` → `simulateTrainingBattle` with `disableCombatModifiers: true`) run **base matrix combat only**:

- No class perks, banner skills, or battle gear effects
- No dual / tri / grand composition bonuses or Emerald Barrier init
- No trainer perk, gear, or banner guild-XP multipliers on drill rewards
- No perk-, gear-, or banner-based injury mitigation (army quality mitigation still applies)

Training battle logs include: `Training run — perks, banners, gear, and composition bonuses are inactive.`

---

## Phase-linking composition (pre-battle)

Before Phase 1, each army evaluates **Valid Active Lanes** — lanes holding ≥ **15%** of total starting HP.

```
compositionEfficiency = lowestActiveLaneHp / highestActiveLaneHp
```

| Active lanes | Archetype | Bonus |
|--------------|-----------|-------|
| 2 | `dual` | Active lane attack × `1 + 0.25 × compositionEfficiency` |
| 3 | `tri` | Attacker counter bonus vs this army capped to `1.5 - 0.40 × efficiency` |
| 4 | `grand` | Phase 4 shield = `20% × Σ(startingLaneHp × survivalRatio)` for ranged/beasts/cavalry |

Skewed placeholder lanes (&lt;15% HP) are excluded from archetype bonuses.

---

## Battle flow

### Phase order

```
Phase 1 — Ranged Volley   (lane: ranged,  *_ART combat types)
Phase 2 — Beasts          (lane: beasts,  *_BST combat types)
Phase 3 — Cavalry Charge  (lane: cavalry, *_CAV combat types)
Phase 4 — Infantry        (lane: infantry, everything else; up to 5 rounds)
```

Constants:

| Constant | Value | Meaning |
|----------|-------|---------|
| `BATTLE_PHASES` | ranged → beasts → cavalry | Phases 1–3 |
| `INFANTRY_MAX_ROUNDS` | `5` | Phase 4 cap |
| `MORALE_START` | `100` | Both armies start here |
| `MORALE_ROUTE_THRESHOLD` | `22` | Morale ≤ this → routed |
| `CASUALTY_ROUTE_RATIO` | `0.68` | Lost ≥ 68% HP → routed |

### Per-phase exchange (Phases 1–3)

For each phase:

1. Skip if **both** sides have no active units in that lane (`attack > 0` and `units > 0`).
2. **Attacker strikes first** (`resolvePhaseStrike(attacker, defender, …)`).
3. If battle not ended, **defender counter-strikes** in the same phase.
4. Stop early if either army gets an `outcome` (`annihilated` or `routed`).

### Infantry phase (Phase 4)

Up to `INFANTRY_MAX_ROUNDS` rounds. Each round:

1. Commander infantry strikes (if lane active).
2. NPC infantry strikes (if still standing).
3. Re-evaluate outcomes for **both** armies.
4. Break on first outcome.

Skipped if both sides lack infantry attack after prior phases.

---

## Army model (`buildBattleArmy`)

Each side is an **army object** with:

| Field | Description |
|-------|-------------|
| `startingHp` / `currentHp` | Sum of stack HP across all lanes |
| `startingUnits` / `currentUnits` | Total unit headcount |
| `morale` | Starts at `MORALE_START` (100) |
| `lanes` | `{ ranged, beasts, cavalry, infantry }` — each has `attack`, `hp`, `units`, `classWeight` |
| `stacks` | Per-stack survivor tracking for XP/casualty allocation |
| `outcome` | `null`, `'annihilated'`, or `'routed'` |
| `outcomeDetail` | Human-readable reason string |

### Lane assignment (`resolveBattlePhaseLane`)

| `combatType` pattern | Lane | Attack stat used |
|---------------------|------|------------------|
| `*_ART` | `ranged` | `rng` |
| `*_BST` | `beasts` | `str` |
| `*_CAV` | `cavalry` | `str` × 2 if unit `special === 'DOUBLE_STRIKE'` |
| default (`*_INF`, etc.) | `infantry` | `str` |

Stats come from catalog promotion key (`app`…`elite`) based on stack `rank` (`PROMOTION_BY_RANK`).

### Counter advantage (`resolveCounterMultiplierFromLane`)

- Loads advantage pairs from `docs/pvp-class-opposition-matrix.json`.
- Defender’s **primary class** = highest `classWeight` across all lanes.
- Attacker lane bonus: `1 + 0.5 × (countering_stack_weight / total_lane_weight)` when attacker class counters defender class.
- Max bonus when entire lane counters: **×1.5** damage.

---

## Damage, casualties, morale

### Strike resolution (`resolvePhaseStrike`)

```
damage = floor(attacker_lane.attack × counter_multiplier)
dealt = applyCasualties(defender, damage)
applyMoraleShock(defender, dealt)
evaluateArmyOutcome(defender)  // may set outcome immediately
```

### Casualties (`applyCasualties`)

- `dealt = min(damage, defender.currentHp)`
- `survivalRatio = (currentHp - dealt) / currentHp`
- `currentHp -= dealt`
- `currentUnits = floor(currentUnits × survivalRatio)` — proportional unit loss
- Stack survivors synced via `syncStackSurvivorsFromArmyUnits`

### Morale shock (`applyMoraleShock`)

```
phaseShock = floor((damageDealt / startingHp) × 45)
heavyLossPenalty = (currentHp / startingHp) < 0.5 ? 8 : 0
morale = max(0, morale - phaseShock - heavyLossPenalty)
```

---

## Army outcome (`evaluateArmyOutcome`)

Evaluated after strikes and at end of infantry rounds. **First matching rule wins** (idempotent if `outcome` already set):

| Priority | Condition | `outcome` | `outcomeDetail` (summary) |
|----------|-----------|-----------|---------------------------|
| 1 | `currentHp <= 0` OR `currentUnits <= 0` | `annihilated` | Every unit destroyed |
| 2 | `morale <= 22` | `routed` | Morale collapse |
| 3 | `currentHp / startingHp <= 0.32` (i.e. ≥ 68% HP lost) | `routed` | Unsustainable casualties |

Returns `null` if army is still fighting.

---

## Winner resolution (`resolveBattleWinner`)

**Inputs:** `commander` army, `npc` army (defender / garrison / training host — naming is historical).

**Down** = `outcome === 'annihilated'` OR `outcome === 'routed'`.

### Decision tree

```
commanderDown = commander has outcome annihilated|routed
npcDown       = npc has outcome annihilated|routed

IF npcDown AND NOT commanderDown:
    winner = 'commander'
    endReason = npc annihilated ? 'annihilation' : 'routing'

ELSE IF commanderDown AND NOT npcDown:
    winner = 'npc'
    endReason = commander annihilated ? 'annihilation' : 'routing'

ELSE IF commanderDown AND npcDown:
  IF commander.currentHp > npc.currentHp → winner = 'commander', endReason = 'routing'
  ELIF npc.currentHp > commander.currentHp → winner = 'npc', endReason = 'routing'
  ELSE → winner = 'draw', endReason = 'mutual_rout'

ELSE (neither down):
  IF commander.currentHp > npc.currentHp → winner = 'commander', endReason = 'infantry_phase'
  ELIF npc.currentHp > commander.currentHp → winner = 'npc', endReason = 'infantry_phase'
  ELSE → winner = 'draw', endReason = 'stalemate'
```

### Winner values

| `winner` | Meaning in UI / downstream |
|----------|----------------------------|
| `'commander'` | Attacker / player side wins |
| `'npc'` | Defender / training host / garrison wins |
| `'draw'` | Both withdraw; no clear victor |

### `endReason` values

| `endReason` | When |
|-------------|------|
| `annihilation` | Loser wiped to 0 HP/units |
| `routing` | Loser routed, or mutual rout HP tiebreak |
| `infantry_phase` | Neither routed; HP comparison after all phases |
| `mutual_rout` | Both routed, equal HP |
| `stalemate` | Neither routed, equal HP after infantry |

---

## Result payload (`simulateTrainingBattle` return)

On success (`ok: true`):

```javascript
{
  ok: true,
  winner: 'commander' | 'npc' | 'draw',
  endReason: 'annihilation' | 'routing' | 'infantry_phase' | 'mutual_rout' | 'stalemate',
  phasesCompleted: number,
  infantryRounds: number,
  roundsPlayed: number,
  phaseParticipation: { ranged, beasts, cavalry, infantryRounds },
  commanderHpRemaining: number,
  npcHpRemaining: number,
  commanderMorale: number,
  npcMorale: number,
  commanderUnitsRemaining: number,
  npcUnitsRemaining: number,
  commanderOutcome: 'annihilated' | 'routed' | null,
  npcOutcome: 'annihilated' | 'routed' | null,
  commanderForce: { hp, hpRemaining, units, unitsRemaining, morale, stacks, outcome, outcomeDetail },
  npcForce: { /* same shape */ },
  log: string[]   // human-readable battle transcript
}
```

On failure (`ok: false`):

- `errorCode: 'NEXUS-AGE-017'` — no units on one or both sides.

### Downstream usage

- **Guild XP / injuries:** `nexus-age-guild-xp.js`, `nexus-age-guild.js` (`resolveBattleInjuryCount`) use `winner`, stack survivors, phase participation.
- **City / army group assault:** `assaultVictory = (battleResult.winner === 'commander')` in `nexus-age-army-group-battle.js`.
- **Client display:** `public/age-adventurers-guild.js` maps `commander` → "Victory", `npc` → "Defeat".

---

## Defender roster scaling (context only)

Roster building does **not** change victory rules; it changes defender strength.

| Context | Builder | Notes |
|---------|---------|-------|
| Guild training | `buildTrainingNpcArmy` | Rank-band units, target total 11–35, mode scale 0.78–1.18 |
| City garrison | `buildCityGarrisonArmy` in `nexus-age-city-battle.js` | Base `border-patrol` roster × settlement tier × ally count |
| Explicit stacks | Pass `templateStacks` to `buildTrainingNpcArmy` | Used for garrison; qty capped at `TRAINING_NPC_MAX_UNITS` (35) |

City assault uses **healthy stacks only** (`injuredQty` excluded).
 

## Key functions (quick index)

| Function | File | Role |
|----------|------|------|
| `simulateTrainingBattle` | `nexus-age-battle-sim.js` | Main sim loop |
| `evaluateArmyOutcome` | `nexus-age-battle-sim.js` | Annihilation / rout checks |
| `resolveBattleWinner` | `nexus-age-battle-sim.js` | Final victor + endReason |
| `executeGuildTrainingBattle` | `nexus-age-battle-sim.js` | Guild API wrapper |
| `executeCityAssaultBattle` | `nexus-age-city-battle.js` | City assault wrapper |
| `executeCityAssaultBattleWithLedger` | `nexus-age-guild.js` | Ledger-aware assault + injuries |
| `prepareArmyGroupAttack` | `nexus-age-army-group-battle.js` | Combined army assault |

---

## Related documentation

- `docs/pvp-class-opposition-matrix.md` — 8-class counter matrix used in lane damage
- `docs/provisions-progression-curve.md` — recruitment / rank economy (not battle resolution)
- `docs/guild-battle-controls-code-reference.md` — UI wiring for training battles

---

## Change checklist

When modifying victory logic:

1. Update **`nexus-age-battle-sim.js`** constants and/or `evaluateArmyOutcome` / `resolveBattleWinner`.
2. Sync **this document**.
3. Check downstream: guild XP multipliers, injury counts, assault relocation (`assaultVictory`), watchtower seize messaging.
4. No Cloudflare cache bust needed unless client display strings change in `public/*.js`.
