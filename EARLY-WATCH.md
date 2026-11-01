# Experimental early-base watch

## Current notification policy

Early-watch Telegram notifications are disabled. The worker continues scanning and recording AI-approved observations privately for learning. An observed timestamp is never represented as a Telegram delivery timestamp. Delivered alerts and silent observations retain separate outcome datasets and shadow models.

Confirmed Sniper signals are shortlisted by the existing heuristic quality rubric: highest five currently eligible confirmed setups, then Gemini review and fresh quote checks. The previous arbitrary 85/100 veto has been removed because it was not validated as improving outcomes. All structural, one-minute confirmation, price, spread, risk and freshness guards remain required. Send at most three successful signals per 15-minute scan invocation, ranked by shortlist order among qualifying approvals. Do not fill missing ranks with unconfirmed candidates. Ranking is among setups passing the market-wide filters, not a forecast of the five best-performing coins. The score is relative selection quality, not demonstrated superiority or win probability.

This local-only worker checks all currently active Binance crypto USDT perpetual contracts every minute. The cloud backup retains its existing 15-minute confirmed-signal strategy. Turning off the PC stops this additional early watch.

The detector uses only closed one-minute bars: a 20-minute range at most 1.5%, a liquidity sweep at least 0.05% beyond its edge with at least 2x baseline volume, and an immediate reclaim beyond the sweep candle with directional close strength at least 0.75. These provisional engineering thresholds are not demonstrated profitability or a calibrated confidence estimate.

Only fresh patterns reach Gemini. Before and after review, reject spreads above 0.1%, quotes extended more than 0.15% from the reclaim close, invalidation breaches, and confirmations older than 90 seconds. Messages are explicitly labeled **early watch, not a confirmed Sniper entry**. A single case does not validate the strategy. Maximum three reviews per sweep is a workload bound, not a daily alert quota. No paid fallback is enabled; provider quotas still apply.

Private `.early/` state records pending delivery before sending, and suppresses uncertain retries and repeat symbol/direction messages for one hour. A local scheduled task runs each minute, on login, and retries failures; it uses a named mutex to prevent overlap. Machine suspension, network outages, exchange restrictions, and model quotas can still delay or prevent alerts.

The existing two-hour learner independently labels delivered early watches for a 0.5R initial move before invalidation within five minutes. At least 20 matured examples and both classes are required to fit a separate shadow model. This cohort never mixes into confirmed-entry training and does not change live selection automatically. Neither this target nor the heuristic score is win probability.

Retrospective LITUSDT case: the 2026-10-31 21:05 Thai minute swept the base to 2.7148; the 21:06 candle closed at 2.7215 and became observable at 21:07. Forward replay with candles restricted to those closed at evaluation found this watch. This is a case study discovered after seeing the chart, not out-of-sample validation, a reconstruction of a live message, or proof the live AI/quote checks would approve it.

Run `node early-base.test.mjs` and `node early-watch.test.mjs` for causal detector checks and isolated approved/rejected/outage/unknown-delivery/dedup tests.
