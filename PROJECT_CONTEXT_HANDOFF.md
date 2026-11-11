# BOWER JJ — Complete Project Context & Handoff Document
**Last Updated**: November 11, 2026 | **Target**: 24/7 Dedicated Server & Production Client

This document provides complete, seamless context for continuing pair-programming on another computer (e.g. desktop PC) in Google Antigravity.

---

## 1. Project Overview & Architecture
- **Game**: **BOWER JJ** — Full-stack multiplayer Euchre platform with competitive ranking, seasonal Battle Pass, dynamic AI bots, and custom house rules.
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide icons, Canvas Confetti, Vite. Deployed live on Vercel at `https://bower-jj.vercel.app`.
- **Backend**: Authoritative Node.js WebSocket & HTTP server listening on port `3001` (`server/index.ts`).
- **Database**: Cloud-hosted **Supabase PostgreSQL** on AWS Oregon (`aws-1-us-west-2.pooler.supabase.com:6543/postgres`).
- **Edge Networking**: Self-healing Cloudflare HA tunnel (`cloudflared.exe`) managed by `server/tunnelSupervisor.ts`. Automatically writes the live public WAN URL into `public.server_registry` in Supabase.
- **Frontend Resolution**: Client automatically queries `server_registry` in Supabase on startup, routing mobile/browser players to whichever machine is running the server.

---

## 2. Infrastructure Credentials & Configuration
- **Supabase URL**: `https://luqyiarxemhreuxfuzwz.supabase.co`
- **Supabase Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4`
- **PostgreSQL Database URL**: `postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres`
- **Supabase Service Role Key**: `sb_secret_SLbztoCvf...` (stored securely in local `run_server.bat`)
- **GitHub Repository**: `https://github.com/adamabraham15/bower-jj` (branch: `main`)
- **Vercel Production URL**: `https://bower-jj.vercel.app`

---

## 3. Key Accomplishments & State of the Codebase
1. **100% Authoritative PostgreSQL Migration**:
   - Replaced legacy `db.json` with relational PostgreSQL schema: `profiles`, `player_ranks`, `player_xp`, `player_statistics`, `player_match_history`, `friendships`, `friend_requests`, `server_registry`.
   - Idempotency key tracking prevents duplicate match completions.
2. **Social & Friend Requests (Fixed & Verified)**:
   - `getIncomingFriendRequests` and `getFriendsSummary` query PostgreSQL directly.
   - Live WebSocket notifications dispatch to the recipient instantly when a friend request is sent (`"[Sender] sent you a friend request!"`).
   - Turkeysub's pending request to StephenAbraham was verified in tests.
3. **Multiplayer Resilience & Auto-Healing**:
   - `server/tunnelSupervisor.ts` monitors public WAN health every 30 seconds and auto-downloads `cloudflared.exe` if missing.
   - Frontend `MultiplayerClient` includes exponential backoff auto-reconnect and direct PostgREST fallback for registry lookups.
4. **Mobile & UI Enhancements**:
   - Cleaned up game table footer during trick resolution ("Resolving Trick...").
   - Hidden redundant table elements during `game_over`.
   - Elevated trump indicator into top header for mobile readability.
   - Matchmaking modal automatically clears connection banners upon authentication.
5. **Full Test Suite**:
   - **82/82 unit and integration tests passing** across 12 test suites (`npx vitest run`).

---

## 4. How to Run on PC
1. Run `npm install`.
2. Generate or run `run_server.bat` with the environment variables above.
3. The server connects to PostgreSQL, spawns `cloudflared.exe`, and updates `server_registry`.
4. Players on `bower-jj.vercel.app` connect automatically!
