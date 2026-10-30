# No1 Crypto Watch Cloud

Experimental Binance USDT perpetual scanner with Gemini review and Telegram alerts. Standard GitHub Linux runner executes approximately every 15 minutes while the user's PC is off. GitHub schedules can be late or skipped; stale signals are rejected.

Repository Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY. Do not put values in source. Private state is a pinned no1-monitor-state.json document in the user's existing Telegram Bot chat; no state or alert history is published to GitHub. Do not delete/unpin the state document while monitoring. No unrelated existing pin is replaced during setup.

AI review cap: 50 attempts per Thai calendar day, including failures. Maximum 5 candidates per invocation, sorted by breakout volume ratio. No paid fallback and no exchange trade credentials. Actual Gemini free quota depends on account/provider limits.

The private dashboard reads public workflow status only, not private alerts. Test with node test.mjs. Use workflow_dispatch with test_telegram to verify cloud Telegram delivery.

No auto-trading. Not backtested or proven profitable; model approval is qualitative. GitHub may disable schedules after inactivity, and some runner locations cannot access Binance. Check Actions for failures. Local monitoring must remain available until cloud execution is verified.
