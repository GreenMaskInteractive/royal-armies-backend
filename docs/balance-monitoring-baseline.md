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

## Baseline thresholds

Baseline values live in:

- `data/balance-monitor-baseline.json`

Current checks:

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
4. Tune thresholds in `data/balance-monitor-baseline.json` as balancing goals evolve.
5. If issues repeatedly trigger, tune the underlying mechanic values.

## Notes

- Logging is designed to be non-blocking: telemetry failures do not break gameplay flows.
- This monitor is for balancing diagnostics, not player-facing analytics.
