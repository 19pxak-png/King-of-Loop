# 40 FPS Gang Bot V3

Discord.js v14 bot for the 40 FPS GTA/FiveM gang server.

## V3 features

- `/setup-server` — creates the 40 FPS server structure, leave system, and Kind of Loop system.
- `/setup-leave` — installs the leave panel.
- `/setup-loop` — installs Kind of Loop channels and rules.
- `/kind-of-loop` — submit a **photo evidence**, number of people, and optional IC names. **1 person = 1 point**.
- `/score` — view your own Kind of Loop score.
- `/leaderboard` — view the top 10 scoreboard.

## Kind of Loop workflow

1. Run `/setup-server` as Administrator, or `/setup-loop` if the server is already set up.
2. Members use `/kind-of-loop`.
3. Required: `people` (1–50) and `evidence` (image). Optional: `names`.
4. The bot posts the evidence in `🏆・หลักฐาน-kind-of-loop` and adds the points to the member's score.
5. The bot posts a score ledger line in `📊・คะแนน-kind-of-loop`.

## Railway environment variables

```text
DISCORD_TOKEN=your_bot_token
GUILD_ID=your_discord_server_id
```

Do not commit or share the bot token.

## Discord Developer Portal

Enable these Privileged Gateway Intents:

- Presence Intent
- Server Members Intent
- Message Content Intent

Invite the bot with both scopes:

- `bot`
- `applications.commands`

## Important: score storage

V3 writes score data to `data/kind-of-loop-scores.json`. On Railway, the local filesystem may be reset when a service is rebuilt/redeployed. For permanent score storage, attach a persistent Railway Volume or later move the score store to a database/Google Sheet.
