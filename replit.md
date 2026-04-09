# Amagi AI Agent

A full-featured autonomous AI Agent web app built on top of a GoatBot V2 messenger bot project.

## Architecture

### AI Agent Web App (`agent-web/`)
- **`server.js`** — Express backend running on port 5000
  - SSE-based streaming chat endpoint (`/api/chat`)
  - File system API (`/api/files`)
  - Checkpoint API (`/api/checkpoints`)
  - Agent loop with Gemini function calling
- **`public/`** — Static frontend (vanilla JS, no build step)
  - `index.html` — Main layout (3-panel IDE-like UI)
  - `style.css` — Dark theme styles
  - `app.js` — Frontend logic (chat, file tree, editor, checkpoints)
- **`workspace/`** — Virtual filesystem the agent can read/write/execute
- **`checkpoints/`** — Saved workspace snapshots

### Original GoatBot (`index.js`, `scripts/`, etc.)
The original Facebook Messenger bot with custom features:

#### Multi-Account Support
- `account.txt` — Primary bot (Bot 1), uses `registeredGroup.json`
- `account2.txt` — Secondary bot (Bot 2), uses `registeredGroup2.json`, detected via bot ID comparison

#### Registration System (`bot/handler/handlerAction.js`)
- Unregistered group + non-admin sender → bot fully silent
- Unregistered group + admin sender → only role-2 commands run
- Registered group → full bot operation

#### Sequential ID System
- `IDuser`: auto-assigned sequential number (1, 2, 3...) stored in `userData.data.IDuser`
- `IDgroup`: auto-assigned for groups stored in `threadData.data.IDgroup`
- Assigned in `handlerAction.js` before registration check — runs for all events

#### Economy System (`scripts/cmds/economy.js` — onChat)
- Each message in registered groups awards 0.04–0.90 money + 1–5 EXP
- Stored in `userData.money` and `userData.exp`

#### Command `.c` (role 2, admin only)
- `.c gr [IDgroup]` — Register group (current or by IDgroup)
- `.c ugr [IDgroup]` — Unregister group
- `.c gi [IDgroup]` — Group info (name, ID, IDgroup, members, admins, status)
- `.c ban <IDuser>` — Ban user by IDuser
- `.c unban <IDuser>` — Unban user
- `.c ui [IDuser]` — User info (name, IDuser, status, uang)

#### Dual-AI Amagi (`scripts/cmds/amagi.js`)
- Bot 1: Amagi character (Luxion personality + normal), separate brain in `amagiBrain.json`
- Bot 2: Configurable system prompt (`BOT2_SYSTEM_PROMPT`), separate brain in `amagiBrain2.json`

## AI Agent Features
- **Autonomous agent loop** — Gemini calls tools iteratively until task is complete
- **7 tools**: readFile, writeFile, listFiles, deleteFile, runCommand, createCheckpoint, restoreCheckpoint
- **Streaming** — SSE for real-time agent thoughts + tool results
- **File Explorer** — Tree view, create/open/delete files, edit in browser
- **Code Editor** — In-browser textarea editor with save
- **Checkpoint System** — Snapshot/restore workspace state
- **Logs Panel** — Real-time agent action log
- **Safety** — Dangerous command blocking, workspace path sandboxing

## API Key
Gemini API key sourced from `scripts/cmds/amagi.js`
Model: `gemini-2.0-flash`

## Workflows
- **AI Agent** — `node agent-web/server.js` on port 5000 (webview)
- **Bot Start** — `node index.js` (console, GoatBot)
