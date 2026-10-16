# AR0087 - Plan

- Job: 2026-10-16-plan-ticket-spec-feature-1832d029
- Planned at: 9f889d85a02fc4feb31fed9ee3f37e477f4abc97

## Approach

The project list lives in `arthur.config.ts` and nowhere else, as options of a new `projects` plugin. That follows vision decision 13 ("no separate JSON file"). There is no `project.json` per repository, and no file wins over another because there is only one. The harness's K0240 (a job spawned inside a repository was registered nowhere) cannot happen here: a job's project is always `--project <name>` or the main one, the first in the list. The core never guesses a project from the current folder.

**Fields of one project:**
- Required: `name`, `prefix`, and exactly one of `path` or `repo`.
  - `name`: lowercase letters, digits, dots and dashes, such as `portfolio.example`. It is used as a folder name and by `--project`.
  - `prefix`: capital letters, the rule the board already applies (`board.ts` `projects()`).
- Optional:
  - `title`: one line, at most 60 characters, defaults to the name.
  - `about`: one line, at most 300 characters.
  - `install`: a shell command.
  - Data that later plugins read, checked here for shape only: `tracker` (`{ plugin, instance?, project }`), `ci` (`{ workflow }`), `commitRules` (exactly one of `regex`, `words`, `file`), `autoMerge` (boolean), `requires` (`{ os?, arch?, tools? }`), `docker` (boolean). Whether a value makes sense (an instance exists, a regex compiles) is checked by the plugin that owns it. So the "`tracker.instance` the tracker plugin does not have" refusal moves to entry 44.
- No aliases. Title and about already give the coordinator the natural names. A later need is one more optional field.
- Any other key is refused at load, naming the project and the key.
- `prompts` is left out of this entry. Today the core's prompt loader reads fixed folders (`roles.ts` `PROJECT_FILES`), so a configured `prompts` would be silently ignored. It comes with the entry that makes the loader and the coordinator (25) read it.

**Refused at load, each refusal naming the project:**
- Two projects whose `name`, `prefix` or `title` are the same, compared without case and across the three keys. For example, a project named `ka` and another with prefix `KA` are refused. So an exact word in the owner's message always means exactly one project.
- Two projects with one folder.
- A `path` that is not an existing folder holding `.git`. Without this check, the board's `create` would make folders under a missing path, because it runs `mkdirSync` with `recursive`.
- An `about` over 300 characters or with a line break, a `title` over 60 characters.
- Two known lockfiles and no `install`.

Relative paths count from the current folder. `cli.ts` always loads `arthur.config.ts` from there, and the service's `WorkingDirectory` is the checkout (`docs/deploy.md:69`).

**`repo` projects:**
- Cloned into `reposDir`, which is required only when some project uses `repo`. It must be outside Arthur's home folder, because job worktrees sit beside each clone.
- The clone happens during `setup` when `<reposDir>/<name>` is missing. It clones to a temporary name and renames, so a failed clone leaves no folder and the refusal names the project.
- A clone that is already there with another `origin` is refused and left untouched.

**The MP case (one project in two checkouts, or with client branches):** each checkout is its own project, with its own name, prefix and folder. The same `repo` in two entries is fine.
- Evidence: the harness's `shop/main` and `shop/south` are two clones of `shop.git`, and both use prefix MP on separate boards (172 and 118 tickets). So ids MP0001 to MP0118 exist twice.
- A client branch is a checkout on that branch, declared as its own project. There is no `branch` field.
- The app repositories under `repos/` (gitignored in the MP env) stay as they are.

**How the coordinator matches a word.** The plugin adds one block to the coordinator's context through `collect("coordinator.context")`, which entry 25 reads. It is one header sentence plus one line per project, in config order:
- Header: "A prefix, name or title, in any case, names that project; a word found in only one project's title or about names it; a word that fits none or several: ask which, naming the candidates. Without `--project` a spawn or ticket goes to the first, the main one."
- Each line: `MP Shop (shop): <about>`. The `(name)` is left out when it equals the title; `: <about>` is left out when there is none.
- Each line is at most about 410 characters, so 9 projects are at most about 3.7k characters; with the real abouts, about 1.5k.

**`arthur projects` and `/projects`** (one registered command) show the same lines. Under each line it prints the folder, the number of open tickets (not merged or dropped) and the install that applies. A broken board gets `board unreadable: <error>` on that project's line only.

**Install in each new worktree:** a `prepare` hook for every job kind.
- It runs `install` if set. Otherwise it picks by the lockfile found at the job's base commit (`git ls-tree` in the main checkout): `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`, `composer.lock` or `uv.lock`, each with its frozen install.
- `install: ""` turns it off. With no lockfile it does nothing and says nothing: the worker role already says to install from the lockfile. So "said once in the job's log" is dropped, because a plugin has no way to write a job's log.
- Two lockfiles found at the base commit refuse the spawn.
- It runs through `host.jobs.run(job.machine, ["sh", "-c", 'cd "$1" && exec sh -c "$2"', …])`, so another machine takes the same path.
- A failed install refuses the spawn, naming the project and the command. The core then removes the worktree, as it already does.

**`arthur doctor` (entry 80):** the plugin provides `collect("doctor")` with one requirement per project, `<name> about`: `ok`, or a non-critical `missing: no about`, with costs ("the coordinator knows it only by prefix, name and title") and a fix (add `about` in `arthur.config.ts`). A missing folder or a failed clone is already a refusal at load.

**Adding a project:** a few lines in the config (`name`, `prefix`, `path`, and ideally `title` and `about`), checked with `arthur projects`. `arthur init` and onboarding come with entry 42. There is no `arthur project add`: it would rewrite TypeScript the human owns, and the vision says adding a project is a config edit, reviewed like code.

**Core changes, kept small:**
- `board.ts` exports its existing list check.
- The job runner's `checkout` (`jobs.ts`) takes the project's folder from that list when a plugin provides `projects`. An unknown name is refused with the list of projects. Without a list it keeps today's main-only behaviour.
- `host.projects()` is not added. `host.board.projects()` already serves the checked list. The roadmap text is updated, and AR0033 (the `--project` check) uses it.

**Left alone:** onboarding (42), trackers (44), the harness, `prompts`, the worktree guard (AR0059), the `--project` check in the CLI (AR0033).

Following the recommendations below: no `pathPrepend`, and no running-jobs count in `/projects`.

**The harness migration, as a worked example:**

```ts
projects({
	list: [
		{ name: "arthur", title: "Arthur", prefix: "AR", path: "/srv/arthur", about: "Small core that runs agent jobs in Git worktrees and keeps the ticket board, with plugins switched on from one config; the public successor of the harness." },
		{ name: "harness", title: "Harness", prefix: "K", path: "/srv/harness", about: "The harness Arthur replaces: one coordinator directing agent jobs in worktrees; takes only fixes until the switch." },
		{ name: "shop", title: "Shop", prefix: "MP", path: "/srv/shop/main", about: "Work environment for the North and South shop apps (backend, frontend, server setup in repos/): work that goes into both apps." },
		{ name: "south", title: "Shop South", prefix: "LA", path: "/srv/shop/south", about: "The shop work environment for work that goes only into the South app (tracker key S)." }, // prefix: open question
		{ name: "portfolio.example", prefix: "KA", path: "/srv/portfolio.example", about: "The owner's portfolio (Astro, Bun): who he is and what he offers; it succeeds when a visitor sends the contact form." },
		{ name: "helpdesk", title: "Helpdesk", prefix: "CS", path: "/srv/helpdesk", about: "Internal app (Bun), like YouTrack or Jira, that keeps each client's agreements and project vision beside its tasks; the owner administers it, client staff sign in." },
		{ name: "qa-board", title: "QA Board", prefix: "QA", path: "/srv/qa-board", ci: { workflow: "Linux" }, about: "Overlay on YouTrack that turns each QA finding into its own thread with a status and a blocker flag, so none is missed before a release." },
		{ name: "reviewer", title: "Reviewer", prefix: "EL", path: "/srv/reviewer", about: "Review tool on issue trackers." },
		{ name: "acme-ev", title: "Acme EV charging", prefix: "EDLS", path: "/srv/acme-ev", about: "Landing page that gathers leads for choosing and installing EV chargers, for the client Acme: drivers, homes and businesses." },
	],
}),
```

How each harness setting maps:
- `.h/repos`: becomes this list.
- `project.json`: `prefix` becomes `prefix`; MP's `automerge` becomes `autoMerge: true`; QA's `ci` becomes `ci.workflow`.
- `spec/clients.json` (`north` N, `south` S): becomes `tracker: { plugin: "youtrack", instance: "shop", project: "N" | "KM" }` once entry 44 defines instances.
- `ISSUES.md`: stays in each repository.
- `H_PATH_PREPEND` (bun): not needed, because `bun` is `/srv/.local/bin/bun`, which `docs/deploy.md` step 4 already puts on the service's `PATH`.
- Installs found: `bun install --frozen-lockfile` for KA, CS, QA and EL; `npm ci` for AR, K and EDLS; nothing for MP.
- `shop/north` exists but was never registered with the harness; it would be a third project if wanted.

## Not available directly

- **Per-project `pathPrepend` in a job's environment.** The core cannot put variables into a job's environment: `Prepare` returns `void` (`jobs.ts:67`), and the wrapper starts `omp` with `process.env` plus `ARTHUR_JOB` only (`wrapper.ts:109`). Every harness use of `H_PATH_PREPEND` is bun, which is already on the service `PATH`.
  - Option 1: build the env contract in the core now: `prepare` may return variables, a `PATH` value goes in front of the machine's `PATH`, an `env` file in the record, passed to `remote-job launch` on stdin; entries 70 and 82 name this change anyway. Cost: about 40 core lines across `jobs.ts` (already at 200 lines), `wrapper.ts`, `remote-job.ts`, `job-machine.ts`, plus docs. Risk: conflicts with AR0025 (entry 22), which is in progress on the same files.
  - Option 2: drop `pathPrepend`. Tool folders go on the service `PATH` (`~/.config/arthur.env`, deploy.md step 4) and at the top of `~/.bashrc` on another machine. Cost: an edit of vision line 71 and of the roadmap and the example config. Risk: two projects that need different versions of one tool cannot be served (none today).
  - Option 3: apply `pathPrepend` only to the plugin's own install, and leave the job's environment to entry 70. Cost: small. Risk: half an option, since the agent's own commands would miss the folders.
  - Recommendation: Option 2.
- **"Running jobs" in `/projects`.** A plugin has no way to list jobs. `host.jobs.list()` arrives with AR0080, after orchestration (23), and a plugin may not read the core's `jobs/` folder.
  - Option 1: `/projects` shows no job count; `/jobs` already shows each job's project. Cost: one roadmap edit. Risk: none.
  - Option 2: wait for AR0080 and add the count then. Cost: entry 41 waits on entry 23. Risk: delay.
  - Option 3: build `host.jobs.list()` now. Cost: about 10 core lines. Risk: two tickets designing one API.
  - Recommendation: Option 1.
- **The readers of `coordinator.context` (entry 25) and `doctor` (entry 80) are not built yet.**
  - Option 1: provide both now, in the shapes those entries describe, and test them through the fake host's `collect`. Cost: about 20 lines. Risk: a shape change later is a small edit in those tickets.
  - Option 2: leave both to entries 25 and 80. Cost: none now. Risk: this ticket's Done means and Scope (the context line) would be unmet.
  - Recommendation: Option 1.

## Files

- `packages/projects/package.json`: new package `@arthur/projects`, no dependencies, `exports` `"."` pointing to `./src/projects.ts`.
- `packages/projects/src/projects.ts`: the plugin factory. Its `setup` provides `projects`, `coordinator.context` and `doctor`, registers the `projects` command with its phone form, and registers the install `prepare` hook.
- `packages/projects/src/project-options.ts`: the `check` of options. Covers each key's shape, required keys, unknown keys, name and prefix rules, cross-key uniqueness, one folder per project, title and about limits, and `reposDir` (required with `repo`, outside home).
- `packages/projects/src/clone.ts`: resolves `path`, checks for `.git`, clones a missing `repo` (temporary name, then rename), refuses a clone with another `origin`, and refuses two lockfiles without `install`.
- `packages/projects/src/install.ts`: picks the install command from `install` or the lockfile at `job.base`, and runs it through `host.jobs.run`.
- `packages/projects/docs/commands/projects.md`: the doc page of `arthur projects` and `/projects`, with what a project entry holds and how to add one.
- `packages/projects/test/*.test.ts`: tests against `@arthur/core/testing` `fakeHost`, with real Git in temporary folders.
- `packages/core/src/board.ts`: export the existing `projects(lists)` check (renamed `projectList`) so the job runner reuses it.
- `packages/core/src/jobs.ts`: `checkout` reads the project list when one is provided; it moves to its own file if `jobs.ts` would exceed 200 lines. `roles(project)` follows.
- `packages/core/src/testing.ts`: comment only. The fake host spawns from the project's folder when a list is provided, else from `root`. The file stays at 200 lines or fewer.
- `packages/core/test/spawn.test.ts`: a spawn with `--project` for the second project starts from that project's HEAD; an unknown name is refused, naming the projects. Existing assertions on `project` change to the list's name.
- `packages/core/docs/commands/spawn.md`, `roles.md`: the `--project` lines and the refusal text; line 16 says the `projects` plugin installs.
- `test/structure.test.ts`: `BUDGETS` gains `projects: 320`.
- `package-lock.json`: the new workspace, via `npm install`.
- `arthur.config.example.ts`: the projects section gets `title` and `about`; `pathPrepend` and `prompts` are removed; `reposDir` is set outside `.arthur`.
- `spec/roadmap.md`:
  - entry 41: Delivers and Done means as settled here;
  - line 14: `host.board.projects()` instead of `host.projects()`;
  - entry 25: gains `prompts`;
  - entry 44: gains the `tracker.instance` check;
  - entry 80: gains the projects requirement;
  - the Settings row "Folders in front of PATH" points to `docs/deploy.md`.
- `spec/vision.md`: line 71 drops "folders in front of `PATH`" (Option 2).
- `docs/deploy.md`: one line in step 4. Tools that a project's jobs need go on the service `PATH`, and at the top of `~/.bashrc` on another machine.
- `README.md`: the status line names the projects plugin.

## Risks

- **The main project's name changes.** It is now the list's first `name`, not the folder's basename. Records and tests that assert `project` change. This is intended, and the existing spawn tests show it.
- **A missing folder blocks every command.** A `path` that does not exist refuses the load, so even core commands such as `arthur stop` cannot run until the config is fixed. Accepted, because the alternative is the board making folders under a missing path. The refusal names the project and the folder.
- **Cloning at load.** Cloning in `setup` means the first command after adding a `repo` project waits for the network. Later commands only run `git remote get-url` for `repo` projects and a `.git` check for `path` projects.
- **An install that hangs** holds the spawn, because `host.jobs.run` has no timeout. Not added: the ticket does not ask for it.
- **AR0025 (entry 22)** is in progress on the job runner. The core part here touches only `checkout` and `board.ts`. The worker starts after AR0025 merges, or rebases onto it.
- **`jobs.ts` and `testing.ts` are both at 200 lines.** `checkout` moves out to its own file, and the comment edit keeps `testing.ts` within its size.
- **Two readers do not exist yet.** The shapes of `coordinator.context` and `doctor` follow the text of entries 25 and 80; those tickets adjust them if they change.
- **Plugin boundary.** The plugin imports only `@arthur/core/plugin` and `@arthur/core/testing`, which the structure test enforces.

## How to test

- **The plan settles every point** (where the list lives, fields, MP, matching, context and its length, adding a project, doctor, the migration): this document. The settled text goes into roadmap entry 41 and the doc page.
- **Option refusals** (`project-options` test): one test per refusal, each asserting the message names the project:
  - a missing name, prefix, or both/neither of `path` and `repo`;
  - a bad name or prefix;
  - a duplicate name, prefix or title, including cross-key and case-insensitive (`ka` against `KA`);
  - two projects with one folder;
  - an `about` of 301 characters or with a line break, and the 300-character limit itself; a `title` of 61 characters;
  - an unknown key; a wrong type for each of `tracker`, `ci`, `commitRules` (zero or two forms), `autoMerge`, `requires`, `docker`, `install`;
  - `reposDir` missing while a project uses `repo`, or inside home.
- **Clone** (`clone` test, real Git, a local bare repository as the `repo` URL):
  - a missing clone is made and listed;
  - a bad URL refuses, naming the project, and leaves no folder;
  - an existing clone with another `origin` is refused and its files are unchanged;
  - an existing clone with the same `origin` is not cloned again;
  - a `path` without `.git` is refused;
  - two lockfiles with no `install` are refused, naming the files.
- **The list:** `fake.collect("projects")` gives absolute paths in config order. `host.board.create` writes into the second project's folder with its prefix.
- **Job runner:**
  - a core test where `--project` names the second project: the worktree comes from that project's HEAD and the record holds its name;
  - an unknown name is refused, listing the names;
  - with no list, the existing spawn tests pass.
- **Install** (fake `npm` and `bun` scripts on a test `PATH` that record their arguments):
  - `install: "touch installed"` creates the file in the worktree;
  - `bun.lock` runs `bun install --frozen-lockfile`;
  - `install: ""` runs nothing;
  - no lockfile runs nothing;
  - two lockfiles at base refuse the spawn;
  - an exit 1 refuses the spawn, naming the project and the command, and the worktree and record are gone;
  - a read-only kind also installs.
- **Context block:** the header and lines in config order; `(name)` left out when it equals the title; a project without `about` has no colon part.
- **`arthur projects` and `/projects`:**
  - lines, folder, open-ticket count (merged and dropped excluded) and install;
  - a hand-broken `spec/build.json` gives that project its error line while the others print;
  - the phone reply equals the shell output.
- **Doctor:** a project with `about` gives `ok`; one without gives non-critical `missing: no about`, with costs and fix.
- **Smoke:** a temporary folder with an `arthur.config.ts` that imports `packages/projects/src/projects.ts`, two real Git repositories and the fake agent. Run `arthur projects`, `arthur spawn --project <second> "…"` (the worktree has the installed marker), and `arthur ticket new` with `--project`.
- **Checks:** `npm test` and `npm run check` pass, with the structure test holding the `projects` budget.

## Open questions

- The south checkout needs a prefix other than MP, because one prefix belongs to one board. Is `LA` right? Should the unregistered `shop/north` checkout join as a third project (for example `LB`)?
- Do you accept dropping per-project `pathPrepend` (Option 2 above, which edits vision line 71)? Or should the core get the job-environment contract now (Option 1)?
