# Context System — The Legend of Zelda (NES)

This folder holds the project's knowledge base and agent coordination system.

## File map

**Top level** — deep knowledge:

| File | Purpose |
|---|---|
| `PROJECT.md` | What and why — scope, goals, non-goals |
| `ARCHITECTURE.md` | How the pieces fit — stack, boundaries, asset inventory |
| `CONVENTIONS.md` | Working rules — session discipline, code standards |
| `PLAN.md` | The 45 slices — the full build roadmap |
| `DECISIONS.md` | Settled choices and why, plus open questions |
| `PROGRESS.md` | Archived session history |

**`agent/`** — the entry point for any agent picking up work:

| File | Purpose |
|---|---|
| `00-readme.md` | Start here — onboarding and orientation |
| `01-progress-tracker.md` | **THE live handoff log** — current state |
| `02-project-overview.md` | Condensed project overview |
| `03-architecture.md` | Condensed architecture |
| `04-code-standards.md` | Implementation rules |
| `05-ai-workflow-rules.md` | Session contract |
| `06-ui-context.md` | Rendering, sprites, audio specifics |

## How to use

- **Starting a session:** Read `agent/01-progress-tracker.md` first, always.
- **New to the project:** Read `agent/01` through `agent/05`.
- **Deep reference:** Files in this directory (one level up from `agent/`).
- **Ending a session:** Update `agent/01-progress-tracker.md` before you stop.
