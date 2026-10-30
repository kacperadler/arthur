# AR0589 - Plan

- Job: 2026-10-30-plan-9016159f
- Planned at: 42ce8ac080f18e43938cedf17451b4182725268a

## Approach
Each project gets its own folder, `projects/<name>/`. The folder holds `project.config.ts` and, if the owner wants, that project's own docs and criteria. `arthur.config.ts` keeps the core options and each plugin with accounts, once, and names the project folders in order, the first being the main project. Every path written in a project file counts from that project's folder. The project's name is the name of its folder.

```ts
// projects/shop/project.config.ts: only this project's pieces, each made by its plugin's helper
export default [
	projects.project({ prefix: "SH", path: "../../../shop", about: "The online shop" }),
	youtrack.project({ instance: "acme", project: "SHOP" }),
	uptime.project([{ url: "https://shop.example/" }]),
	dokploy.project({ instance: "contabo", app: "XvK9…" }),
];
// arthur.config.ts: accounts once, the project folders named
projects({ folders: ["projects/arthur", "projects/shop"] }),
youtrack({ instances: [...] }), dokploy({ instances: [...] }), uptime(),
```

**How it works:**
- **Helpers.** A helper such as `dokploy.project(x)` only returns a note addressed to its plugin, `{ dokploy: x }`. The projects plugin imports each project file and checks it:
  - it is a list of pieces, each with exactly one key;
  - it has exactly one `projects.project(...)` piece;
  - no plugin has two pieces.

  It then serves each project as today, with one new field, `pieces`. A plugin reads its own piece from there, `project.pieces.dokploy`, through `host.collect("projects")`, as youtrack reads `tracker` today. No plugin imports another.
- **How a plugin declares and checks its piece.** A plugin gets one new optional field, `piece(value, options)`: its check of one project's piece. Having the field is the declaration. At start the host runs that check on every project's piece before the plugin's own `setup`, and refuses the start naming the project and the helper, e.g. `project shop: dokploy.project(...): instance "x" is not an instance of dokploy`. Each plugin's check covers its own rules, so the projects plugin no longer checks any other plugin's key.
- **`arthur doctor`.** A piece that no enabled plugin declares gets one non-critical line, for example a disabled plugin or a hand-written key: `shop dokploy  missing: no enabled plugin reads dokploy.project(...)`, with the fix "enable dokploy in arthur.config.ts, or remove the line from projects/shop/project.config.ts". It is a doctor line, not a refusal. The reason is that inside a job a plugin whose variable is unset is not loaded (`packages/core/src/host.ts:47-50`), so its pieces must not break the job's own commands.

**What moves. No old shape is kept, and an old `list`, `sites` or `mode` is refused as an unknown option:**
- uptime's `sites` → `uptime.project([...])`
- findings' `mode` → `findings.project("summary")`. It is keyed by project name the same way as `sites`, and the owner's real config uses it.
- `tracker` → `youtrack.project({ instance?, project })`
- `ci` → `github.project({ workflow })`
- `commitRules` → `commitRules.project(...)`. A `file` is then read from the project folder, no longer from Git.
- `autoMerge` → `delivery.project({ autoMerge })`
- `requires` → `machines.project({ os?, arch?, tools? })`
- Planned, with no package yet, so only text changes: `chat` → `orchestration.project({ chat })` (roadmap 85, vision) and `docker` → `docker.project(false)` (example config).
- `dokploy` → `dokploy.project(...)`, built by AR0588.

`projects.project(...)` keeps only what the projects plugin and the core read: `prefix`, `path` or `repo`, `title`, `about`, `install`, `prompts`.

**Docs and criteria in the folder.** A `prompts` path written in the project file (`vision`, `criteriaDir`, `rolesDir`) is read from the project folder and must stay inside it. Left out, the defaults stay in the repository and are read from the job's worktree, as today, so Arthur's own `spec/vision.md` stays committed and workers can still edit it. `arthur init` and the onboarding kind write only repository files, so they refuse a project whose prompts point into its folder, and the owner writes those files himself.

**Left alone:** schedule entries naming a project, channel instances, the board, the coordinator's context lines, `reposDir`, and how `arthur.config.ts` itself loads. `projects/` is added to `.gitignore`, because the real project list stays off GitHub (`spec/vision.md:27`).

**Order of the work:**
1. **AR0589 ticket 1** (shape and cutover) comes first.
2. **AR0588** (both tickets, dokploy) follows once ticket 1 is merged. It can run beside ticket 2: they touch different packages.
3. **AR0589 ticket 2** (a job sees only its project).
4. An optional **ticket 3** (Not available directly, B).

**What AR0588's worker changes in its approved plan:**
- **Drops:**
  - the `FIELDS` line and `ProjectEntry.dokploy` in `packages/projects`;
  - the `projects: 484` budget raise;
  - the `dokploy` key in `packages/projects/docs/commands/projects.md`;
  - its section "If settings stay in per-plugin sections";
  - its risk line about AR0589.
- **Adds:**
  - `dokploy.project = (piece) => ({ dokploy: piece })` in `dokploy.ts`;
  - the plugin's `piece` check, carrying the refusals its plan already lists (the instance exists or an unnamed one does; `app` is an id; never a value printed);
  - its setup reads `project.pieces?.dokploy`.
- **Docs and tests:** its docs show the instances in `arthur.config.ts` and `dokploy.project(...)` in a project file. Its tests give the fake host projects with `pieces: { dokploy: … }`. "Following AR-D389" becomes AR-D391.
- **Unchanged:** commands, instances, the fake and the zip. It still hands nothing to jobs.

**Cost:**
- **Ticket 1:** about +150 lines of `src/` across 10 packages and about 400 test lines changed. One worker run and one review; it is the largest of the tickets.
- **Ticket 2:** about +45 lines of `src/` and about 150 test lines. One worker run and one review, on the local machine, where Landlock runs.
- **AR0588:** two lines less in projects; about +8 lines in dokploy, inside its proposed 450.
- **Budget raises:** core 6503 → about 6575, core/testing 369 → about 375, projects 482 → about 570, plus small raises in youtrack, uptime, findings, github, commit-rules, delivery and machines (+2 to +10 each). Each raise shows in that merge's outcome.md.
- **The owner's real config:** the coordinator rewrites it once, at ticket 1's merge (Risks).

## What a job on a project knows
A job on shop1 gets shop1 and nothing else that Arthur hands it. The coordinator alone sees every project: it runs in `arthur run`, outside any job (no record, no sandbox), and loads every project file. Its context comes from `projects`' `coordinator.context` and orchestration's `context.ts`.

| A job of shop1 gets | Where it is enforced | Test that proves it |
| --- | --- | --- |
| Its worktree, made from shop1's checkout | `packages/core/src/jobs.ts` spawn, `checkout(folder, collect("projects"), project)` in `job-checkout.ts` | existing spawn tests; ticket 2's new sandbox test reads it |
| In its prompt: the role, shop1's override, criteria and vision (from its worktree, or from `projects/shop1/` once written there) | `packages/core/src/roles.ts` `prompt()` with `promptFiles(shop1)` | `roles.test.ts`, plus ticket 2's assertion that the prompt holds no shop2 text |
| The sections plugins add for shop1, e.g. its YouTrack project or commit rules | each plugin's `prompt` provider picks `job.project`'s piece (`youtrack.ts:41`, `commit-rules.ts:37`) | each plugin's tests, e.g. commit-rules "a project without commitRules gets no hook and no text" |
| Variables a plugin's `prepare` returns for shop1 (nvm's PATH, a model key) | each `prepare`; `job-scope.ts:65` drops every `ARTHUR_` variable of Arthur's own | `model.test.ts:152` |
| Inside the job, `arthur` loads only shop1's project file (ticket 2) | projects plugin, with the new `host.job` | new test in `packages/projects/test/projects.test.ts` |

| Never | Where it is enforced | Test |
| --- | --- | --- |
| Another project's files: its checkout, its project folder, other jobs' worktrees (ticket 2) | `packages/core/src/job-sandbox.ts` `hidden()`, from `<home>/projects/checkouts` and `<home>/projects/folders`, which no job can write | new `sandbox.test.ts` test: a job of shop1 gets Permission denied on shop2's checkout, `projects/shop2/project.config.ts` and a shop2 job's worktree; it reads its own worktree and folder |
| A token | the env file hidden (`job-sandbox.ts:80`); in a job the CLI reads no env file (`host.ts:47-50`); values replaced by their names in the prompt and record (`secret-names.ts`) | `sandbox.test.ts:544`, `host.test.ts:247`, `model.test.ts:152` |
| `arthur.config.ts` | **not enforced**: a job's own `arthur` commands load it (Not available directly, A). After ticket 1 it holds no project setting and no value | none |

**Still readable after ticket 2, stated plainly:**
- the shared home `.arthur/`: the event log, other jobs' records and tasks, the coordinator's files (Not available directly, B);
- other projects' names and checkout paths: the job's record `projects` file and `<home>/projects/checkouts`, which the worktree guard needs;
- Arthur's install, and with it the checkout it sits in (here the arthur project);
- a model provider key the models plugin hands a job on purpose (`keyEnv`, `docs/deploy.md:34`);
- the task text, which the coordinator writes;
- jobs on another machine, where nothing more is hidden [INFERENCE: I did not trace the hidden list on another machine].

## Not available directly
- **A. Hiding `arthur.config.ts` from a job.** Inside a job, the CLI loads it from the working folder (`packages/core/src/cli.ts:73`) for every command that may run there: help, jobs, roles, findings, the board commands, decisions, ci, github reads, plugin new and others (`inJob: true` in 21 files). Landlock hides a file from every process in the job, `arthur` included.
  - Option 1: keep it readable. After ticket 1 it holds only core options and accounts (names, URLs, variable names), no project setting and no value. Cost: none; risk: a job sees account names and URLs.
  - Option 2: hide it and drop every in-job command. Cost: the roles that tell jobs to run them change; risk: workers lose their findings, board and CI reads.
  - Option 3: hide it and have the core write a per-job config. Cost: the config is code (plugin calls), so it needs a new data format; risk: a large new design.
  - Recommendation: Option 1.
- **B. A job of shop1 sees nothing of shop2 in the shared home.** The event log mixes every project's events and the owner's messages. `arthur jobs` reads every record. The CLI inside a job runs every plugin's setup, which reads that plugin's folder under the home (`host.ts:62-70`). Landlock can hide each entry of the home but the job's own record (`job-sandbox.ts` walk), but each in-job setup must then survive it, which I did not audit.
  - Option 1: leave the home readable in ticket 2, name it in `docs/deploy.md` "Threat model", and close it in ticket 3. Cost: one more ticket later; risk: until then a shop1 job can read shop2's events and job tasks.
  - Option 2: hide it in ticket 2. Cost: an audit of every plugin's setup inside a job, roughly doubling ticket 2; risk: an in-job command breaks.
  - Recommendation: Option 1, with ticket 3 opened now.

## Files
Ticket 1: project folders and pieces.
- `packages/core/src/plugin.ts`: a new optional `piece?: (value: unknown, options: Options) => string | undefined` on `Plugin`.
- `packages/core/src/host.ts`, plus a new `packages/core/src/project-pieces.ts` if host.ts would pass 200 lines:
  - before each plugin's `setup`, run its `piece` on every project's `pieces[<name>]`, refusing as `project <p>: <name>.project(...): <problem>`;
  - in `checks`, one doctor line per piece that no enabled plugin with `piece` reads.
- `packages/core/src/roles.ts`: `promptFiles` accepts an absolute path (from the project folder, which projects serves as a real path); `projectFile` reads it with the same symlink check.
- `packages/core/src/testing.ts`: the fake host's `setup` runs the plugin's `piece` checks first, as the host does.
- `packages/core/docs/commands/roles.md`, `doctor.md`; `docs/plugin-api.md`: the `piece` field, the `pieces` field of `projects`, the doctor line.
- `packages/projects/src/project-options.ts`:
  - options `folders` (relative to the config folder) and `reposDir`;
  - `FIELDS` becomes the projects piece: `prefix`, `path`, `repo`, `title`, `about`, `install`, `prompts`; `name` comes from the folder; `tracker`, `ci`, `commitRules`, `autoMerge`, `requires`, `docker` are deleted;
  - prompt paths are resolved inside the folder.
- `packages/projects/src/project-file.ts` (new, about 70 lines): imports `<folder>/project.config.ts` and refuses, naming the file:
  - a missing file, or one that is not a list;
  - a piece without exactly one key;
  - two pieces of one plugin;
  - no projects piece, or a bad one;
  - a folder name that is not a valid name, or two folders with one name;
  - `path` and prompt paths resolved against the folder.
- `packages/projects/src/projects.ts`: setup loads from `folders` (async); `Project` gains `folder` and `pieces`; `projects.project` helper.
- `packages/projects/src/init.ts`, `onboarding.ts`: refuse a project whose prompts point into its folder.
- `packages/youtrack/src/youtrack.ts`: `youtrack.project`; `piece` checks `{ instance?, project }`, the instance exists, `SHORT_NAME`; reads `pieces.youtrack`.
- `packages/uptime/src/uptime-options.ts`, `uptime.ts`: `sites` option deleted; its site checks become `piece`; `uptime.project`; reads `pieces.uptime`.
- `packages/findings/src/findings-options.ts`, `findings.ts`: `mode` deleted; `findings.project(mode)`; `piece`.
- `packages/github/src/github.ts`: `github.project({ workflow })`; `piece`; reads `pieces.github`.
- `packages/commit-rules/src/commit-rules.ts`, `hook.ts`, `commit-rules-options.ts`: `commitRules.project`; `piece` checks the shape and that the regex compiles; `file` read from `project.folder`.
- `packages/delivery/src/auto-merge.ts`, `delivery.ts`: `delivery.project({ autoMerge })`; `piece`.
- `packages/machines/src/machine-place.ts`, `machines.ts`: `machines.project(requires)`; `piece`.
- Each package's `test/`: fixtures give `pieces`; the refusals listed under How to test.
- Docs:
  - `packages/projects/docs/projects.md`, `docs/commands/projects.md`, `init.md`;
  - `packages/uptime/docs/uptime.md`, `packages/findings/docs/findings.md`, `packages/youtrack/docs/` [INFERENCE: its options page], `packages/github/docs/commands/ci.md`, `packages/commit-rules/docs/commit-rules.md`, `packages/delivery/docs/commands/merge.md`, `packages/machines/docs/machines.md`;
  - `arthur.config.example.ts` (folders, and a commented example project file);
  - `README.md:100`, `docs/setup.md:94` (step 5).
- `spec/vision.md`: lines 18, 27, 31, 72, 196, 206, 217, 227 now say "one folder per project, named in arthur.config.ts".
- `spec/roadmap.md`: a new entry (next free number) and the `chat` text of 85 and 86.
- `.gitignore`: `projects/`. `CHANGELOG.md`.
- `test/structure.test.ts`: the budgets above.

Ticket 2: a job sees only its project (local machine).
- `packages/core/src/plugin.ts`, `plugin-host.ts`, `host.ts`, `cli.ts`: `Host.job?: { id, project }`. `loadPlugins` takes `insideJob`'s id instead of a boolean and reads the record's `project`.
- `packages/core/src/testing.ts`: a `job` option on the fake host.
- `packages/projects/src/projects.ts`:
  - inside a job it imports only `host.job.project`'s folder, and refuses when there is none;
  - it does not rewrite `checkouts` there;
  - it writes `<folder>/folders` (`<name> <project folder>`) beside `checkouts`.
- `packages/core/src/job-sandbox.ts` `hidden()`, read once before the install as today (`wrapper.ts:64`):
  - adds each other project's checkout and folder;
  - adds every entry of each project's `.arthur-worktrees` but the job's own;
  - never hides a path that holds the job's worktree, root, Git folder, record, home, install or config.
- `packages/core/docs/commands/spawn.md` ("The sandbox", line 120), `help.md`; `docs/deploy.md` "Threat model"; `docs/plugin-api.md` (`host.job`); `CHANGELOG.md`.
- `packages/core/test/sandbox.test.ts`, `host.test.ts`, `packages/projects/test/projects.test.ts`: the tests below.

## Risks
- **The cutover can take Arthur down.** After ticket 1 merges, the old `arthur.config.ts` refuses to load, and the session plugin restarts `arthur run` by itself once no job runs (`packages/session/docs/session.md:77`).
  - Ticket 1's worker reads the real config and writes, in its final message, the new `arthur.config.ts` and `projects/arthur/project.config.ts`. It checks both against its branch in a temporary copy with `arthur config check`. Nothing is committed: the list stays off GitHub.
  - The coordinator saves them as `arthur.config.next.ts` and `projects/arthur/` before the merge. Old code ignores both.
  - It runs `arthur merge`, then right away `mv arthur.config.next.ts arthur.config.ts` and `arthur config check`.
  - The steps go in ticket 1's outcome.md.
- **A malformed piece crashing a plugin's setup:** the host runs `piece` before that plugin's `setup`.
- **Prompt paths in the folder through a symlinked parent** read as "a symlink": projects serves the folder's real path, and a test covers a symlinked home.
- **A project file's `@arthur/*` imports** resolve only from under Arthur's folder: the docs say to keep `projects/` beside `arthur.config.ts`, and a test loads a folder there.
- **Commit-rules `file` now comes from the folder, not Git:** a project keeping its rules in the repo moves the file. The real config uses a regex, so it is untouched.
- **Ticket 2 hiding a job's own needs**, through nested checkouts or a shared `.arthur-worktrees`: own paths are never hidden, entries are hidden one by one, and a test covers projects in one parent folder.
- **No Landlock (macOS, no `python3`):** nothing more is hidden. The narrowed in-job load still holds. The log line and the docs say so, as today.
- **AR0588 and ticket 2 in parallel** both raise budgets in `test/structure.test.ts`, which is laid out so such raises merge cleanly.

## How to test
Each Done means point:
- **The shape of AR-D391** (folder, file, helpers, paths relative to the folder, accounts once):
  - `projects.test.ts` loads two folders: names from the folders, `path` from each folder, `pieces` served, main first.
  - It refuses each malformed file listed under Files, and an old `list`.
  - `roles.test.ts`: a `criteriaDir` in the folder is read from there, a left-out one from the worktree, one leading out of the folder is refused.
- **A plugin declares and checks its piece through the host, importing no other plugin:**
  - `host.test.ts` with fake plugins: `piece` runs before that plugin's setup, and the refusal names the project and the helper.
  - Inside a job, a plugin left unloaded has its pieces not checked.
  - The structure test still bans cross-plugin imports.
- **What moves, no old shape kept:** each plugin's tests read their piece and keep their refusals. `uptime({ sites })` and `findings({ mode })` are refused as unknown options. AR0588's tests use `pieces.dokploy`.
- **`arthur doctor` reports a piece no enabled plugin reads:** a host test with a disabled plugin's piece and a hand-written key gives one non-critical line each, and none when every piece is read. Smoke run: `arthur doctor` in a temporary Arthur with `dokploy.project` and no dokploy.
- **Line budgets:** `npm test` (the structure test) and `npm run check`, each in one call with a 1800 s timeout.
- **What a job knows (ticket 2):**
  - `sandbox.test.ts`: a job of shop1, with a shop2 checkout, folder and job worktree on disk, gets Permission denied on each shop2 path and on the env file; it reads its worktree and `projects/shop1/`; its prompt holds no shop2 text.
  - `projects.test.ts` with `job: { project: "shop1" }`: only shop1 is served, shop2's file is never imported (it writes a marker file when imported, and the marker stays absent), and `checkouts` is untouched.
  - Smoke run: a real spawn of a fake agent in a temporary Arthur with two projects, with `cat` on the other project's files.
- **The tickets:** listed under Approach. End-to-end smoke for ticket 1: the migrated real config passes `arthur config check`, `arthur projects` and `arthur roles` in a temporary copy.

## Open questions
- Prompt files: should the defaults stay in the repository as planned (written paths come from the folder), or should `vision.md` and `criteria/` in the project folder be the default?
- The plan moves every key another plugin reads (`ci`, `commitRules`, `autoMerge`, `requires` too). Or do you want only the ones the ticket names moved (`sites`, `tracker`, `chat`, `dokploy`, and `mode`)? Then the other four stay keys of `projects.project(...)`.
- A piece of a disabled plugin is a doctor line, as the ticket says, not a refusal at start as the coordinator described it to you (message of 15:01). Is a doctor line enough?
- `arthur.config.ts` stays readable to jobs (Not available directly, A, Option 1). Is that acceptable?
- Shall ticket 3, which hides the shared home `.arthur/` from jobs, be opened now (Not available directly, B)?