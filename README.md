# Prompter

Prompter is a self-hosted Next.js app plus a CLI for managing prompts, workflows, kanban tasks, executions, and schedules against the same SQLite/libSQL-backed data store.

The package is published as **`@tayor/prompter`** and exposes the **`prompter`** binary for both `npx` and global installs. Use the published package when you only need the CLI; run the full app from a local checkout.

## What is in this repo

- **Prompt management** with variables, favorites, pinning, archive support, duplicate detection, restore/history, and usage tracking
- **Workflow management** with step editing, reordering, version restore, duplication, templates, and guided runs
- **Tasks, queue, execution, and schedules** for kanban-style automation, single-task execution control, retries, reruns, logs, and cron/one-time schedules
- **Organization and discovery** through folders, tags, full-text search, analytics, activity feeds, templates, and import/export flows
- **Admin and model tooling** through JWT cookie auth, password management, admin CLI commands, model discovery, and model default configuration

## Stack

| Layer | Details |
| --- | --- |
| App | Next.js 16 App Router + React 19 |
| Database | Prisma 7 + SQLite/libSQL |
| UI | Tailwind CSS 4 + shadcn/ui + Radix |
| Validation | Zod |
| State | Zustand + React hooks |
| CLI | Node.js entrypoint backed by the same service layer as the app |

## Requirements

- Node.js **^20.19 || ^22.12 || >=24.0**
- npm 10+
- A writable SQLite/libSQL database; the CLI defaults to `file:./prompter.db` when `DATABASE_URL` is unset

## Develop from a local checkout

```bash
cp .env.example .env
npm install
npm run db:init
npm run dev
```

Open `http://localhost:3000`.

## Install the CLI from npm

### `npx`

```bash
npx @tayor/prompter help
npx @tayor/prompter version
```

### Global install

```bash
npm install -g @tayor/prompter
prompter help
prompter version
```

### Important runtime note

Commands that read or mutate Prompter data must be run from a **Prompter project root** containing:

- `package.json`
- `prisma/schema.prisma`
- a configured database (`DATABASE_URL` or `./prompter.db`)

`help` and `version` work anywhere. Commands like `doctor`, `prompt`, `workflow`, `task`, `execution`, `queue`, `schedule`, `settings`, `analytics`, `admin`, and `model` expect a real Prompter project.

## Local scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Generate Prisma client and build the app |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Node test suite for CLI, services, and kanban logic |
| `npm run cli -- <args>` | Run the CLI from this checkout |
| `npm run db:init` | Rebuild the database from the canonical seed bundle |
| `npm run db:seed` | Rebuild the database from the canonical seed bundle |
| `npm run db:reset` | Force-reset and rebuild from the canonical seed bundle |
| `npm run db:studio` | Open Prisma Studio |

## CLI usage

```bash
# from the repo checkout
npm run cli -- help
npm run cli -- doctor
npm run cli -- prompt list --limit 5

# with the published package
npx @tayor/prompter prompt list --limit 5
prompter workflow list --limit 5
```

### Global CLI options

- `--json`
- `--quiet`
- `--output <table|json|raw>`
- `--data '<json>'`
- `--file <path-to-json-or-yaml>`

### Command groups

| Group | Commands |
| --- | --- |
| Runtime | `help`, `version`, `doctor` |
| Prompts | `prompt list`, `get`, `create`, `update`, `delete`, `use`, `versions`, `restore` |
| Workflows | `workflow list`, `get`, `create`, `update`, `delete` |
| Workflow runs | `run start`, `list`, `get`, `complete`, `cancel` |
| Folders | `folder list`, `get`, `create`, `update`, `move`, `delete` |
| Tags | `tag list`, `get`, `create`, `update`, `merge`, `delete` |
| Search | `search <query>` |
| Templates | `template list`, `instantiate` |
| Settings | `settings get`, `update`, `reset-usage` |
| Analytics | `analytics report`, `activity`, `trends`, `track` |
| Import/export | `import <file>`, `export --format <json|yaml>` |
| Admin | `admin list`, `upsert`, `delete`, `doctor` |
| Models | `model list`, `discover`, `get`, `update`, `config` |
| Tasks | `task list`, `get`, `create`, `update`, `delete`, `move`, `reorder` |
| Execution | `execution start`, `stop`, `status`, `cancel`, `retry`, `rerun`, `list`, `get`, `log` |
| Queue | `queue list`, `shuffle`, `full`, `single`, `feeling-lucky` |
| Schedules | `schedule list`, `get`, `create`, `update`, `delete`, `pause`, `resume`, `run-now` |

### Scheduling examples

```bash
prompter schedule create --data '{"name":"one-off-maintenance","type":"one_time","runAt":"2026-04-22T10:00:00","timezone":"America/Vancouver","taskId":"<task-id>","skipIfTaskRunning":true}'

prompter schedule create --data '{"name":"weekday-sync","type":"cron","cronExpression":"0 9 * * 1-5","timezone":"UTC","taskId":"<task-id>","allowConcurrentRuns":false,"skipIfTaskRunning":true,"catchUpMissedRuns":false}'

prompter schedule run-now <schedule-id> --at 2026-04-22T09:00:00 --timezone UTC
```

## App routes and API surface

### Pages

- `/` dashboard
- `/prompts`, `/prompts/new`, `/prompts/[id]`, `/prompts/[id]/history`
- `/workflows`, `/workflows/new`, `/workflows/[id]`, `/workflows/[id]/run`
- `/tasks`
- `/folders`
- `/tags`
- `/search`
- `/templates`
- `/analytics`
- `/archive`
- `/settings`
- `/login`

### API route groups

| Area | Routes |
| --- | --- |
| Auth | `/api/auth/login`, `/api/auth/logout`, `/api/auth/password` |
| Prompts | `/api/prompts`, `/api/prompts/[id]`, `/copy`, `/duplicate`, `/resolve`, `/versions`, `/restore/[versionId]`, `/bulk`, `/duplicates`, `/export` |
| Workflows | `/api/workflows`, `/api/workflows/[id]`, `/duplicate`, `/export`, `/versions`, `/restore/[versionId]`, `/run`, `/run/[runId]`, `/steps`, `/steps/[stepId]`, `/steps/reorder` |
| Organization | `/api/folders`, `/api/folders/[id]`, `/api/folders/[id]/move`, `/api/tags`, `/api/tags/[id]`, `/api/tags/merge`, `/api/search`, `/api/templates` |
| Analytics/settings/data | `/api/analytics`, `/api/analytics/activity`, `/api/analytics/trends`, `/api/settings`, `/api/settings/reset-usage`, `/api/import`, `/api/export`, `/api/models/[provider]` |
| Tasks and scheduling | `/api/tasks`, `/api/tasks/[id]`, `/api/tasks/batch/move`, `/api/tasks/batch/reorder`, `/api/execution/*`, `/api/executions`, `/api/executions/[id]`, `/api/executions/[id]/log`, `/api/executions/events`, `/api/queue/*`, `/api/schedules`, `/api/schedules/[id]`, `/api/schedules/[id]/{pause,resume,run-now}` |

## Project layout

```text
bin/                      Runtime CLI entrypoint
prisma/                   Prisma schema, canonical seed bundle, and seed runner
public/                   Static assets
src/app/                  Next.js routes and API handlers
src/cli/                  CLI parser, commands, bootstrap, and output
src/components/           Layout, shared, and ui components
src/lib/                  Prisma client, validators, services, kanban runtime, utilities
src/stores/               Zustand stores
middleware.ts             Auth middleware
```

## Operational notes

- The app uses a **JWT in the `auth-token` cookie** for authentication.
- Many Prisma fields are stored as serialized JSON strings and converted in the service layer.
- Prompt content edits create new `PromptVersion` records.
- Workflow steps are ordered by an integer `order` field.
- Schedule dispatch uses optimistic locking to prevent duplicate claims.
- Execution state enforces a single running task invariant.

