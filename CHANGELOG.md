# Changelog

All notable changes to Giraffe are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/).

## [1.3.0-beta] – 2026-11-06

Repository restructured to the project layout of Lightfox, DOM Picker für LLM and
ask-when-needed. **Bot behaviour is unchanged**; the existing `database.db` in the project root
keeps working.

### Changed

- Layout: `index.js` → `src/index.js`, `commands/` → `src/commands/`, `events/` → `src/events/`,
  `deploy-commands.js` → `scripts/deploy-commands.js`, `src/public/` → `public/`.
- Start via `npm start`, register slash commands via `npm run deploy`. `docker-compose.yml` now
  runs `npm start`.
- `package.json`: name `giraffe-discord-bot`, version `1.3.0-beta`, description, `license`,
  `main`, `engines.node >= 22.13` (needed for `node:sqlite`).
- `.gitignore` also ignores the SQLite WAL files (`database.db-shm`, `database.db-wal`) and
  logs/OS files.
- README: logo, badges and EN/DE language switch; the German dashboard section is now part of
  the English README; development section with project structure.

### Added

- `DB_PATH` environment variable to override the SQLite file (default: `database.db` in the
  project root).
- `tests/smoke.mjs` (`npm test`): loads every command and event through the real loader against
  an in-memory database and checks that all slash commands serialise.
- `README.de.md` (German), `LICENSE` (MIT), `CHANGELOG.md`, `docs/logo.svg`.

## Earlier history

Summarised from the git history before versioning was introduced.

- **2026-10-22** – Switched to `node:sqlite`, per-command cooldowns, embed support and empty-embed
  check in the dashboard's send form; voice time and messages attributed to their day in SQL.
- **2026-10-21** – Web dashboard (status, stats, birthdays, send messages; Express);
  feature-based file structure with shared DB handle and loaders; auto-role for new members.
- **2026-10-17** – Birthday system (`/birthday`, daily scheduler, birthday role).
- **2026-10-10** – Mistral AI integration: `/ai`, `/websearch`, `/image`, `/poll`; cost per
  request in the footer.
- **2026-08-30** – Provider name and privacy-policy link in AI replies.
- **2026-07-21** – Docker Compose setup.
- **2026-07-09** – Initial commit.
