# Amagi & Rem AI Agent — Dual Bot Project

Dua AI Agent web + Facebook Messenger bot berbasis GoatBot V2.

---

## Arsitektur

### AI Agent Web 1: Amagi Agent (`agent-web/`)
- **Port**: 8976 (main), 5000 (preview/webview)
- **Backend**: `agent-web/server.js` — Express + Gemini (gemini-3.1-flash-lite-preview)
- **API Key**: `GEMINI_API_KEY` env secret
- **Frontend**: `agent-web/public/` — vanilla JS 3-panel IDE UI
- **Fitur**: Chat streaming, baca/tulis file, generate gambar, checkpoint, kirim gambar dari user

### AI Agent Web 2: Rem AI Agent (`rem-web/`)
- **Port**: 8977 (main), 3000 (preview/webview)
- **Backend**: `rem-web/server.js` — Express + GPT-5.4 (OpenAI)
- **API Key**: `OPENAI_API_KEY` env secret
- **Frontend**: `rem-web/public/` — vanilla JS 3-panel IDE UI (sama style dengan Amagi)
- **Fitur**: Chat streaming, baca/tulis file, generate gambar, checkpoint, kirim gambar dari user, baca gambar yang dikirim user

### Navigasi Antar Agent
- Amagi Agent → klik "Rem AI" di header → buka port 3000
- Rem Agent → klik "Amagi" di header → buka port 8976 (atau preview default)

---

## Facebook Bot — GoatBot V2

### Multi-Account (2 Bot)
- `account.txt` — Bot 1: **Amagi** (Gemini AI, karakter manja & profesional)
- `account2.txt` — Bot 2: **Rem** (GPT-5.4, karakter maid setia)

### Sistem Registrasi Group (Terpisah Per Bot)
- Bot 1 Amagi: `registeredGroup.json`
- Bot 2 Rem: `registeredGroup2.json`
- Logic otomatis di `bot/handler/handlerAction.js` — deteksi bot via ID
- Unregistered group + non-admin → bot diam
- Unregistered group + admin → hanya command yang jalan
- Registered group → bot penuh aktif

### Command Bot
| Command | Role | Fungsi |
|---------|------|--------|
| `.c gr [IDgroup]` | Admin | Register group |
| `.c ugr [IDgroup]` | Admin | Unregister group |
| `.c gi [IDgroup]` | Admin | Info group |
| `.c ban <IDuser>` | Admin | Ban user |
| `.c unban <IDuser>` | Admin | Unban user |
| `.c ui [IDuser]` | Admin | Info user |

### AI Commands (Scripts)
- `scripts/cmds/amagi.js` — Amagi karakter (Gemini), support gambar dikirim & generate
- `scripts/cmds/rem.js` — Rem karakter (GPT-5.4), support gambar dikirim & generate
- `scripts/cmds/agent.js` — Agent umum (Gemini)

### Database
- `amagiBrain.json` / `amagiBrain2.json` — Memory Amagi bot 1 & 2
- `remBrain.json` / `remBrain2.json` — Memory Rem bot 1 & 2
- SQLite — thread/user data

---

## API Keys (Env Secrets)
| Key | Digunakan Oleh |
|-----|----------------|
| `GEMINI_API_KEY` | agent-web, amagi.js, agent.js |
| `OPENAI_API_KEY` | rem-web, rem.js |
| `XAI_API_KEY` | (legacy, tidak aktif dipakai) |

---

## Workflows
| Nama | Command | Port |
|------|---------|------|
| AI Agent | `node agent-web/server.js` | 8976 / 5000 |
| Rem AI Agent | `node rem-web/server.js` | 8977 / 3000 |
| Bot Start | `node index.js` | — |
