# Crypto Watch Cloud

Experimental Binance USDT perpetual scanner with Gemini review and Telegram alerts.

Runs on standard GitHub-hosted Linux runners every approximately 15 minutes, including while the owner's computer is off. GitHub schedules can be delayed or skipped. It rejects stale signals rather than pretending to provide real-time monitoring.

## Setup

Repository Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY. Never commit these values. Initialize state.enc using the Telegram token before the first run. State is AES-256-GCM encrypted; no chat destination or API key is stored in source. Keep the same bot token or migrate/re-encrypt state before rotation.

Maximum 50 AI review attempts per Thai calendar day, including failures. No paid fallback. Free-tier eligibility remains subject to the user's Gemini account plan and provider limits. No auto-trading, no exchange credentials required.

Public source does not contain credentials or plaintext alert history. The dashboard only reads public workflow status. Telegram holds delivered alerts. State is recorded before sending to prevent repeated alerts; a failed/ambiguous send may therefore be missed.

GitHub may disable scheduled workflows after prolonged repository inactivity. Check Actions for failures. Binance may refuse access from some runner locations. No alternative exchange is silently substituted. The current system must not be stopped until a cloud run succeeds.

This strategy has not been backtested or proven profitable. AI approval is qualitative, not a measured win probability. Run `node test.mjs` for strategy checks.
