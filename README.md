# No1 Crypto Watch Cloud

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
