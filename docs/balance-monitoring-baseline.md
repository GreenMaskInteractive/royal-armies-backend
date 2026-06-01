# Game Balance Monitoring Baseline

This file documents the automated NEXUS balance telemetry added for testing.

## What gets recorded

NEXUS writes one JSON object per line to:

- `runtime/balance-monitor.jsonl`

Each log entry contains:

- `at` timestamp
- `eventType` (`recruitment`, `rank-progression`, `training-battle`)
- `baselineVersion`
- `payload` (mechanic-specific values)
- `issues` (detected imbalance warnings)

## Baseline profiles

Baseline values live in:

- `data/balance-monitor-baseline.json`

The monitor supports multiple baseline profiles:

- `royalArmies` — your primary target profile (shipping decisions)
- `referenceLastKnights` — external pacing reference profile

`monitoring.activeProfiles` controls which profiles are evaluated on each event.

External source curation for the Last Knights reference profile lives in:

- `docs/last-knights-public-mechanics-sources.md`

Current checks per profile:

- **Recruitment**
  - `maxUnitsPerRecruitEvent`
  - `maxTier1UnitsBeforeRank7`
- **Progression**
  - `maxProvisionGrantPerPromotion`
  - `maxEarlyProvisionGrantPerPromotion`
  - `earlyRankCutoff`
  - `maxPromotionsPerBattleEvent`
- **Battle**
  - `maxXpGainPerTrainingBattle`
  - `maxInjuriesPerTrainingBattle`

## How to use during testing

1. Play normal sessions and trigger recruitment + guild battles.
2. Periodically inspect `runtime/balance-monitor.jsonl`.
3. Search for entries where `issues` is non-empty.
4. Review `issuesByProfile` to compare Royal Armies vs Last Knights reference signals.
5. Tune thresholds in `data/balance-monitor-baseline.json` as balancing goals evolve.
5. If issues repeatedly trigger, tune the underlying mechanic values.

## Notes

- Logging is designed to be non-blocking: telemetry failures do not break gameplay flows.
- This monitor is for balancing diagnostics, not player-facing analytics.
- Last Knights values are reference-only and intentionally editable as your own design goals evolve.
- Public posts must be validated as the same game before they are used in baseline tuning.
