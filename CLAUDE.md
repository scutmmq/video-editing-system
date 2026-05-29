# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent workflow (from AGENT.md)

- Before creating, modifying, deleting, moving, or renaming any file, list the proposed changes and affected files first, then wait for explicit user approval. Reading files and running non-mutating inspection commands needs no approval.
- After approved changes, summarize the changed files and verification performed.

## Commands

On Windows PowerShell, prefer `npm.cmd` / `npx.cmd` — the `.ps1` wrappers may be blocked by execution policy.

- Run the app: `npm run start` (serves on http://localhost:3000). Do not open HTML files directly with `file://` — FFmpeg.wasm needs the COOP/COEP headers that `server.js` sets.
- Run all tests: `npm test` (uses Node's built-in `node --test tests/*.test.js`).
- Run a single test file: `node --test tests/mediaUrl.test.js`.
- Run one test by name: `node --test --test-name-pattern="isSupportedProxyUrl" tests/mediaProxy.test.js`.
- Build a Linux executable: `npm run build:exe:linux` (uses `@yao-pkg/pkg`, outputs `dist/video-editing-system-linux`). Deployment via Docker on a remote server — see README.md.

## Architecture

This is a **browser-side video editor with no build step / no bundler**. All processing happens locally in the browser via FFmpeg.wasm; the Node server only serves static files and (eventually) proxies remote media.

### Module loading and dual-environment pattern

- `src/index.html` loads every module with plain `<script>` tags in dependency order. There is no import system in the browser — each module attaches itself to a **global namespace** (e.g. `App`, `Upload`, `Preview`, `TrimModule`, `ffmpegService`, `Status`, `Utils`). New feature modules must be added to both `src/index.html`'s script list and wired into `App.init()` in `src/modules/app.js`.
- Modules that need unit tests use a **UMD wrapper** — `(function (root, factory) { ... })(window||globalThis, factory)` — so they export via `module.exports` under Node and attach to `window` in the browser. See `src/auth/jwtToken.js`, `src/auth/auth.js`, `src/modules/mediaUrl.js`, `src/server/mediaProxy.js`. Tests `require()` these directly. When writing a new testable module, follow this same UMD shape rather than relying on a bundler.
- Feature modules (trim/gif/audio/watermark/filter/cover) share a consistent shape: an object with `init()` that binds DOM handlers, a `validate(...)` helper, and an async `_handle*()` that calls `ffmpegService.process(inputName, inputData, args, outputName)` then `App.showResult(blob, type, filename)`. Use `src/modules/trim.js` as the template for new processing features.

### FFmpeg.wasm

- `src/modules/ffmpeg.js` exposes the singleton `ffmpegService`. It loads `@ffmpeg/core` from local `node_modules` (`/node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js`), not a CDN. `process()` writes input to the wasm virtual FS, runs args, reads output, and cleans up temp files.
- SharedArrayBuffer (FFmpeg multithreading) requires COOP/COEP response headers, set in `server.js` (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`). This is why the app must be accessed through the server.

### Server

- `server.js` is a dependency-free `http` static server. URL mapping: `/` → `src/index.html`, `/login.html` → `src/pages/login.html`, everything else → path under repo root, with a path-traversal guard (`filePath.startsWith(ROOT)`).
- `src/server/mediaProxy.js` is a remote-media proxy (rewrites HLS/m3u8 playlist URLs to route segments through `/media-proxy`, forwards Range headers). **It is implemented and tested but not yet wired into `server.js`** — wiring the `handleMediaProxy` route into the server is the remaining step for the remote-URL video feature (`src/modules/mediaUrl.js` already builds `/media-proxy?url=...` links).

### Auth (Supabase)

- Config is read from `<meta>` tags in `src/index.html` (`supabase-url`, `supabase-publishable-key`). Browser code may only use the public publishable/anon key — never a `service_role` key (in HTML, JS, docs, or `.env.example`).
- `src/config/supabaseClient.js` initializes the client (Supabase SDK loaded via CDN) and exposes `window.VideoEditingSupabase` (`{ client, isConfigured, status, config }`).
- `src/auth/auth.js` (`createAuthController`) handles sign in/up/out; `src/auth/jwtToken.js` validates the session's `access_token` (3-part JWT, parseable payload, valid future `exp`). `src/auth/authGuard.js` runs on the main page and redirects to `/login.html` when no valid session exists. This JWT check is **front-end session-state validation only** — real authorization still depends on Supabase Auth + RLS.

### Database (Supabase / Postgres)

- `supabase/migrations/` is the **source of truth** for schema, RLS, functions, triggers, and Storage policies. Never treat manual Dashboard edits as the source — capture them with `npx.cmd supabase db pull` first. Once a migration is pushed to a shared remote, do not rewrite it; add a new timestamped migration (`YYYYMMDDHHMMSS_description.sql`).
- Store media bytes in Supabase Storage, not Postgres (Postgres keeps metadata + storage paths). Enable RLS before exposing any table to browser code.
- The full collaboration/access flow, login/link commands, and safety rules live in `AGENT.md` ("Supabase Collaboration And Database Workflow"). The linked project ref is `wwqgixluxlegrttyhrgy`.

## Notes

- Tests cover the pure/testable logic (auth, jwtToken, mediaUrl, mediaProxy) — there is no headless-browser test for the FFmpeg processing modules, so verify UI/processing changes manually in the browser.
- README.md's "项目结构" section is slightly stale (it lists `index.html` at repo root; it actually lives at `src/index.html`, and `login.html` at `src/pages/login.html`).
