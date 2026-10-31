# No1 Crypto Watch Cloud

## Broad historical learning

A separate local historical learner collects rolling 30 days of closed 15-minute candles for every currently active Binance crypto USDT perpetual, caching bars and fetching only new bars on later runs. It derives rule candidates with next-open reference entry, the existing drift/stop limits and a four-hour barrier outcome. Ambiguous same-candle TP/SL outcomes are excluded rather than counted favorably. It uses a global chronological training/validation/test split (approximately 21/5/4 days), with a four-hour purge. The historical model remains separate from the actual-delivered-signal model; both make private pre-outcome shadow predictions in new signal journals. Historical candidates have no Gemini or historical bid/ask verification and the active-market universe has survivorship bias. These results cannot be presented as live alert accuracy, and neither model changes live selection.

## Continuous local Machine Learning (shadow only)

The Windows ML trainer runs every two hours and at sign-in, merging private confirmed Telegram journal entries with the initial historical audit. Only Binance signals whose four-hour observation window has matured are eligible. Target=1 means TP before SL within four hours; SL first or neither level touched within four hours is target=0, which does not mean every target=0 trade lost money. Ambiguous/missing outcomes are deferred, and aggregation trades resolve same-minute ordering. Training uses actual send time, never candle-close time as a substitute.

A regularized logistic regression learns four entry-time features: log relative volume, directional close strength, log stop distance percent and Long/Short. Standardization for retrospective tests is fitted only on the earlier training partition. A separate all-matured-data model generates private prospective shadow predictions in each confirmed alert journal. Later trainer runs can link those pre-outcome predictions to matured outcomes. Model weights update only when the training data changes; a failed update retains the last model. Current samples are small and retrospective metrics are not proof of future skill.

Models, training records and seed history stay in ignored `.ml/`; only code goes to GitHub. ML runs locally, calls no Gemini/OpenAI API, and does not consume the 50-call Gemini cap. It is always `shadow`, not calibrated, and cannot change live alert selection, stops or position sizes. The existing Telegram score remains the rule-based quality score. While the PC is off, GitHub backup continues its existing rules; local ML updates resume when Windows is signed in again.

## Learning audit and private journal

Delivered signals now retain exact entry, stop, target, exchange, candle close, verification time, Telegram receipt time/message ID, score components, features and strategy version in the private pinned Telegram state. Pending/uncertain deliveries are distinct from confirmed sends. Nothing from this journal belongs in public GitHub files. A close-strength >=70% candidate filter is logged in shadow mode, without changing live selection or consuming AI calls. Retrospective comparisons on 49 alerts are exploratory, not independent validation; higher heuristic scores did not establish higher win rates. New messages distinguish candle-close time from verification time, and audits use the actual Telegram send time.

## Signal quality score

Each delivered signal includes a heuristic score out of 100 after all existing filters and Gemini approval. Rubric quality-v1: validated structure 30, relative breakout volume 25 (1.5x to 3x), spread 15 (0.1% to zero), entry drift 15 (0.3% to zero), freshness 15 (180 seconds to zero). Components are clamped and rounded. It is not a calibrated win probability, does not change the entry filters, and requires no additional AI calls. Scores from this rubric should not be compared with future rubric versions without adjustment.

## Automatic local recovery

The separate Windows guardian checks every two minutes and at sign-in. It restarts a missing worker or one whose heartbeat is over seven minutes old, stops only the verified worker and its verified scanner child, and retries on later checks if restart fails. Recovery notices are queued during network failure and throttled to one per hour. The monitor task also has failure restarts. The guardian does not reset the shared daily AI quota or scan slot. Power, Windows sign-in, network connectivity, valid credentials and provider availability remain prerequisites; it cannot repair those externally controlled conditions.

Local primary scans every active Binance crypto USDT perpetual contract (COIN, TRADING, PERPETUAL, USDT), without a daily-volume universe threshold. Relative breakout volume, spread, entry drift, stop, freshness and Gemini filters apply after reading all markets. GitHub backup scans Kraken USD perpetuals with a USD 1M daily quote-volume threshold. Both share Telegram state, scan slots and the 50-call daily cap. Standard GitHub Linux runner executes approximately every 15 minutes while the user's PC is off. GitHub schedules can be late or skipped; stale signals are rejected.

Repository Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY. Do not put values in source. Private state is a pinned no1-monitor-state.json document in the user's existing Telegram Bot chat; no state or alert history is published to GitHub. Do not delete/unpin the state document while monitoring. No unrelated existing pin is replaced during setup.

AI review cap: 50 attempts per Thai calendar day, including failures. Maximum 5 candidates per invocation, sorted by breakout volume ratio. No paid fallback and no exchange trade credentials. Actual Gemini free quota depends on account/provider limits.

The public dashboard reads public workflow status only, not private alerts. Test with node test.mjs. Use workflow_dispatch with test_telegram to verify cloud Telegram delivery.

No auto-trading. Not backtested or proven profitable; model approval is qualitative. GitHub may disable schedules after inactivity, and provider access can change. Check Actions for failures. Local monitoring must remain available until cloud execution is verified.

Price source was changed to Kraken Futures because Binance returns HTTP 451 on GitHub runners. Universe and reference prices differ from Binance; each alert labels the source. Liquidity threshold is USD 1 million per 24h. Do not treat Kraken entry/stop prices as exact Binance order prices.
## Runtime status

The 15-minute GitHub schedule is best effort and may skip or delay runs for hours. The private Telegram heartbeat, at most once every six hours after an invocation, reports actual coverage, stale setups, AI rejections/outages, and the gap since the previous invocation. It cannot report a stopped scheduler until another invocation occurs. A successful workflow means the job ran; it does not imply an entry was found. Liquidity filtering is now at USD 1M quote volume per day; spread, entry, stop, freshness, AI, and daily quota safeguards remain enforced.

## Hybrid operation

While the Windows computer is on and logged in, run-local.ps1 checks for each fresh 15-minute close. GitHub is a best-effort backup when the PC is off. Both use the same pinned private Telegram state, daily 50-call budget, and shared slot caption. An identical Telegram caption edit is rejected atomically, so only one runner claims a slot. All state saves retain the slot caption. New scans start only within the first three minutes of a 15-minute slot and requests have a four-minute overall deadline, avoiding overlap with the next slot. Deleting/unpinning/editing the state document may disrupt coordination. The public dashboard reports GitHub runs only; local activity remains private in Telegram.

## Binance full-board validation

Read-only live validation on 2026-10-31 read all 519/519 active crypto USDT perpetual contracts in 15.9 seconds, with zero market-data failures and ONUSDT included. It used no AI calls and sent no trading alerts. Counts change as Binance lists or delists contracts. Spot pairs, crypto indexes, premarket contracts, dated futures and non-USDT quote pairs are outside this universe. Failed reads are counted separately and are never presented as successfully scanned markets. There is no silent exchange fallback when Binance fails on the PC.
