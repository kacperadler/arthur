# AR0087 - Plan

- Job: 2026-10-17-ar0087-plan-revision-391cfd50
- Planned at: 6c77640cda936b3edbab689c336776ea3433037a

## Approach

This revision makes three changes to the filed plan and keeps everything else as it was:
1. Shop becomes three projects: MP, LB and LA.
2. `pathPrepend` is gone. A project's Node version comes from a new `nvm` plugin, roadmap entry 84.
3. Onboarding (entry 42) adds an `.nvmrc` to the project.

The core reached its line limits in the meantime: `jobs.ts` and `testing.ts` are each at 200 lines. AR0025 is now merged.

**Where the list lives.** The project list lives in `arthur.config.ts` and nowhere else, as options of a new `projects` plugin, per vision decision 13. There is no `project.json` per repository, so no file can win over another. The harness's K0240 (a job spawned inside a repository was registered nowhere) cannot happen: a job's project is always `--project <name>` or the main one, which is the first in the list. The core never guesses a project from the current folder.

**Fields of one project:**
- Required: `name`, `prefix`, and exactly one of `path` or `repo`.
  - `name`: lowercase letters, digits, dots and dashes. It is used as a folder name and by `--project`.
  - `prefix`: capital letters, the rule `board.ts` `projects()` already applies.
- Optional: `title` (one line, at most 60 characters, defaults to the name), `about` (one line, at most 300 characters) and `install` (a shell command).
- Optional, read by later plugins and checked here for shape only: `tracker` (`{ plugin, instance?, project }`), `ci` (`{ workflow }`), `commitRules` (exactly one of `regex`, `words`, `file`), `autoMerge`, `requires` (`{ os?, arch?, tools? }`) and `docker`.
  - The plugin that owns a value checks whether it makes sense. So the "unknown `tracker.instance`" refusal moves to entry 44.
- No aliases. Any other key is refused at load, naming the project and the key, and that includes `pathPrepend`.
- `prompts` is left out. `roles.ts` `PROJECT_FILES` reads fixed folders, so a configured `prompts` would be silently ignored. It comes with entry 25.

**Refused at load, each refusal naming the project:**
- Two projects whose `name`, `prefix` or `title` are equal, compared without case and across the three keys (`ka` against `KA` is refused).
- Two projects with one folder.
- A `path` that is not an existing folder with `.git`. Without this check, the board's `mkdirSync` would make folders under a missing path, because it runs with `recursive`.
- An `about` over 300 characters or with a line break; a `title` over 60 characters.
- Two known lockfiles and no `install`.

Relative paths count from the current folder: `cli.ts` loads the config from there, and the service's `WorkingDirectory` is the checkout.

**`repo` projects:**
- Cloned into `reposDir`. It is required only when some project uses `repo`, and must be outside Arthur's home folder.
- The clone happens in `setup` when it is missing. It clones to a temporary name and renames, so a failed clone leaves no folder.
- An existing clone with another `origin` is refused and left untouched.

**The MP case (owner, 2026-10-17): three projects.**
- MP `shop/main`, LB `shop/north`, LA `shop/south`.
- All three are clones of `shop.git` on `main`. Each has its own `spec/build.json`, with 172, 115 and 118 MP tickets today.
- Each checkout is its own project, with its own name, prefix and folder. The same `repo` in several entries is fine. There is no `branch` field: a client branch is a checkout declared as its own project.

**Matching a word to a project.**
- The plugin adds one block to the coordinator's context through `collect("coordinator.context")`, which entry 25 reads.
- The header: "A prefix, name or title, in any case, names that project; a word found in only one project's title or about names it; a word that fits none or several: ask which, naming the candidates. Without `--project` a spawn or ticket goes to the first, the main one."
- One line per project, in config order: `MP Shop (shop): <about>`.
  - `(name)` is left out when it equals the title; the `: <about>` part is left out when there is none.
- An exact match comes first. So "north" means LB, even though MP's about mentions North, and "shop" means MP, even though it is in the LB and LA titles.
- A line is at most about 410 characters. With the 10 real projects the block is about 1.7k characters [INFERENCE: from the abouts below].

**`arthur projects` and `/projects`** (one registered command):
- They show the same lines.
- Under each line: the folder, the open tickets (not merged or dropped) and the install that applies.
- A broken board gets `board unreadable: <error>` on that project's line only.

**Install in each new worktree.** A `prepare` hook for every job kind:
- It runs `install` if set. Otherwise it picks by the lockfile at the job's base (`git ls-tree`): `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`, `composer.lock` or `uv.lock`, each with its frozen install.
- `install: ""` turns it off. No lockfile means nothing runs.
- Two lockfiles refuse the spawn. A failed install refuses the spawn, naming the project and the command.
- It runs through `host.jobs.run(job.machine, ["sh", "-c", 'cd "$1" && exec sh -c "$2"', …])`, so a job on another machine takes the same path.
- "Said once in the job's log" is dropped: a plugin cannot write a job's log.

**`arthur doctor` (80).** The plugin provides `collect("doctor")` with one requirement per project, `<name> about`:
- `ok`, or a non-critical `missing: no about`;
- costs: "the coordinator knows it only by prefix, name and title";
- fix: add `about` in `arthur.config.ts`.

**Adding a project.** A few lines in the config, checked with `arthur projects`. There is no `arthur project add`: it would rewrite TypeScript the human owns. `arthur init` and onboarding stay entry 42.

**Core changes, kept small:**
- `board.ts` exports its existing list check.
- The job runner's `checkout` takes the project's folder from that list. An unknown name is refused with the list of names. Without a list, it keeps today's main-only behaviour.
- `host.board.projects()` serves the list, so `host.projects()` is not added.

**Tool versions (owner, 2026-10-17).** No `pathPrepend`. A new `nvm` plugin, entry 84, puts the Node version named by the project's `.nvmrc` first on the job's `PATH`, on the job's machine. Onboarding (42) adds the `.nvmrc`.
- This ticket builds neither entry 84 nor entry 42. It only writes them into the roadmap.
- Entry 84 needs `host.jobs.prepare` to return variables for the job's environment. Entries 70 and 82 already name that core change, "whichever entry is built first adds them", and 84 joins that list.
- Bun, which KA and CS use, has no nvm. It stays on the service `PATH` at `~/.local/bin`, as `docs/deploy.md` step 4 already writes it.

**Roadmap entries that change** (in `spec/roadmap.md`):
- **41:** Delivers and Done means as settled here.
  - Removed: `pathPrepend`, `prompts`, the "running jobs" in `/projects`, and "said once in the job's log".
  - Moved: the `tracker.instance` refusal goes to 44.
  - Covers drops "the `PATH` setting".
- **42:** `arthur init <project>` also writes `.nvmrc` with the major version of the Node it runs on (`24` today), unless the repository has one.
  - New edge cases: an existing `.nvmrc` is kept unchanged; a repository without `package.json` still gets one.
  - The onboarding job's merge rule ("accepts only those files") is unchanged, because `init` writes the file, not the job.
- **84 (new):** "nvm: each project's Node version", in the Projects section after 42. Package: nvm.
  - Delivers: through `prepare`, for a job whose worktree has `.nvmrc`, it runs `. "$NVM_DIR/nvm.sh" && nvm which <version>` on the job's machine through `host.jobs.run`. That bin folder goes first on the job's `PATH` through the variables `prepare` returns.
  - The install of 41 runs under the same Node: the variables a `prepare` returns reach the prepares after it, and nvm's prepare runs before projects' install.
  - It provides a doctor requirement: nvm present on each machine.
  - Done means:
    - tested against the fake host and a fake `$NVM_DIR/nvm.sh`;
    - no `.nvmrc`: no variable, and the machine's default Node is used;
    - a version that is not installed refuses the spawn, naming the version, the machine and the fix `nvm install <version>`;
    - an empty or unreadable `.nvmrc` is refused, naming the file;
    - nvm missing on the machine is refused, naming the machine;
    - a job on another machine resolves the version there.
  - Depends on: 41, 21, 80.
  - Covers: the `PATH` setting.
- **Host API paragraph (line 14):** `host.board.projects()` instead of `projects()`.
- **25:** gains `prompts`.
- **44:** gains the `tracker.instance` check.
- **80:** gains the projects requirement and nvm's.
- **Settings table:** the row "Folders in front of `PATH` | `projects` `pathPrepend` | 41" becomes "Node version per project | `nvm`, the project's `.nvmrc` | 84".

**Left alone:** building onboarding (42) and nvm (84), trackers (44), the harness, `prompts`, the worktree guard (AR0059), the CLI `--project` check (AR0033), and the job-environment contract (built with 70, 82 or 84).

**The harness migration, as a worked example:**

```ts
projects({
	list: [
		{ name: "arthur", title: "Arthur", prefix: "AR", path: "/srv/arthur", about: "Small core that runs agent jobs in Git worktrees and keeps the ticket board, with plugins switched on from one config; the public successor of the harness." },
		{ name: "harness", title: "Harness", prefix: "K", path: "/srv/harness", about: "The harness Arthur replaces: one coordinator directing agent jobs in worktrees; takes only fixes until the switch." },
		{ name: "shop", title: "Shop", prefix: "MP", path: "/srv/shop/main", autoMerge: true, about: "Work environment for the North and South shop apps (backend, frontend, server setup in repos/): work that goes into both apps." },
		{ name: "north", title: "Shop North", prefix: "LB", path: "/srv/shop/north", autoMerge: true, about: "The shop work environment for work that goes only into the North app (tracker key N)." },
		{ name: "south", title: "Shop South", prefix: "LA", path: "/srv/shop/south", autoMerge: true, about: "The shop work environment for work that goes only into the South app (tracker key S)." },
		{ name: "portfolio.example", prefix: "KA", path: "/srv/portfolio.example", about: "The owner's portfolio (Astro, Bun): who he is and what he offers; it succeeds when a visitor sends the contact form." },
		{ name: "helpdesk", title: "Helpdesk", prefix: "CS", path: "/srv/helpdesk", about: "Internal app (Bun), like YouTrack or Jira, that keeps each client's agreements and project vision beside its tasks; the owner administers it, client staff sign in." },
		{ name: "qa-board", title: "QA Board", prefix: "QA", path: "/srv/qa-board", ci: { workflow: "Linux" }, about: "Overlay on YouTrack that turns each QA finding into its own thread with a status and a blocker flag, so none is missed before a release." },
		{ name: "reviewer", title: "Reviewer", prefix: "EL", path: "/srv/reviewer", about: "Review tool on issue trackers." },
		{ name: "acme-ev", title: "Acme EV charging", prefix: "EDLS", path: "/srv/acme-ev", about: "Landing page that gathers leads for choosing and installing EV chargers, for the client Acme: drivers, homes and businesses." },
	],
}),
```

How each harness setting maps:
- **`.h/repos`:** becomes this list. `shop/north` was never registered with the harness, and now joins as LB.
- **`project.json`:** `prefix` becomes `prefix`. MP, LB and LA all have `automerge: true`, which becomes `autoMerge: true`. QA's `ci` becomes `ci.workflow`.
- **`spec/clients.json`** (`north` N, `south` S): becomes `tracker: { plugin: "youtrack", instance: "shop", project: "N" }` on LB and `"S"` on LA, once entry 44 defines instances.
- **`ISSUES.md`:** stays in each repository.
- **`H_PATH_PREPEND` (bun):** dropped. `bun` is in `~/.local/bin`, already on the service `PATH`.
- **`.nvmrc`:** none of the 10 has one today. All Node projects run on the one installed Node, v24.21.0. Without `.nvmrc`, nvm (84) leaves the default Node in place, so the migration needs nothing. A project pins a version later with a one-line `.nvmrc` commit.
  - Existing boards make `arthur init` refuse these projects, so onboarding will not add it to them.
- **Installs found:**
  - `bun install --frozen-lockfile` for KA, CS, QA and EL;
  - `npm ci` for AR, K and EDLS;
  - nothing for MP, LB and LA.

## Not available directly

- **"Running jobs" in `/projects`.** A plugin cannot list jobs. `host.jobs.list()` comes with AR0080, after entry 23, and a plugin may not read the core's `jobs/` folder.
  - Option 1: no job count in `/projects`, since `/jobs` already shows each job's project - cost: one roadmap edit, risk: none.
  - Option 2: wait for AR0080 - cost: entry 41 waits on 23, risk: delay.
  - Option 3: build `host.jobs.list()` now - cost: about 10 core lines, risk: two tickets designing one API.
  - Recommendation: Option 1.
- **The readers of `coordinator.context` (entry 25) and `doctor` (entry 80) are not built yet.**
  - Option 1: provide both now, in the shapes those entries describe, tested through the fake host's `collect` - cost: about 20 lines, risk: a later shape change is a small edit.
  - Option 2: leave both to entries 25 and 80 - cost: none now, risk: this ticket's Scope (the context line) is unmet.
  - Recommendation: Option 1.

## Files

- `packages/projects/package.json`: new package `@arthur/projects`, no dependencies, export `"."` pointing to `./src/projects.ts`.
- `packages/projects/src/projects.ts`: the plugin factory. `setup` provides `projects`, `coordinator.context` and `doctor`, registers the `projects` command with its phone form, and registers the install `prepare` hook.
- `packages/projects/src/project-options.ts`: the options `check`: key shapes, required and unknown keys, name and prefix rules, cross-key uniqueness, one folder per project, title and about limits, and `reposDir`.
- `packages/projects/src/clone.ts`: resolves `path` and checks for `.git`; clones a missing `repo` (temporary name, then rename); refuses another `origin`; refuses two lockfiles without `install`.
- `packages/projects/src/install.ts`: picks the install from `install` or the lockfile at `job.base`, and runs it through `host.jobs.run`.
- `packages/projects/docs/commands/projects.md`: the doc page: what an entry holds, how to add a project.
- `packages/projects/test/*.test.ts`: tests against `fakeHost` of `@arthur/core/testing`, with real Git in temporary folders.
- `packages/core/src/board.ts`: export the existing `projects(lists)` check, renamed `projectList`.
- `packages/core/src/jobs.ts`: `checkout` reads the list when one is provided. It is at 200 lines, so `checkout` moves to its own file. `roles(project)` follows.
- `packages/core/src/testing.ts`: comment only. It is at 200 lines and stays there.
- `packages/core/test/spawn.test.ts`: `--project` for the second project starts from that project's HEAD; an unknown name is refused, naming the projects; assertions on `project` change to the list's name.
- `packages/core/docs/commands/spawn.md`, `roles.md`: the `--project` lines and the refusal; the `projects` plugin installs.
- `test/structure.test.ts`: `BUDGETS` gains `projects: 320`.
- `package-lock.json`: the new workspace, via `npm install`.
- `arthur.config.example.ts`: the projects section gets `title` and `about`; the `pathPrepend` line (200) and the `prompts` lines are removed; `reposDir` is set outside `.arthur`.
- `spec/roadmap.md`: entries 41 and 42, the new 84, line 14, 25, 44, 80, and the Settings row, as listed in Approach.
- `spec/vision.md`: three edits.
  - Line 71 drops "folders in front of `PATH`".
  - A plugin row: "nvm (named) | first | Each project's Node version, from its `.nvmrc`, first on its jobs' `PATH` through nvm on the job's machine."
  - One line under "Where the less obvious parts live": "A project's Node version: `nvm`, from the project's `.nvmrc`, which onboarding adds."
- `docs/deploy.md`: one line in step 4. A tool a project's jobs need (such as bun) goes on the service `PATH`, and at the top of `~/.bashrc` on another machine. A project's Node version comes from its `.nvmrc` once the nvm plugin (roadmap 84) is on.
- `README.md`: the status line names the projects plugin.

## Risks

- **The main project's name changes.** It is now the list's first `name`, not the folder's basename. Records and tests that assert `project` change; this is intended.
- **A missing folder blocks every command.** A missing `path` refuses the load, so even `arthur stop` waits for the config fix. Accepted: the alternative is the board making folders under a missing path. The refusal names the project and the folder.
- **Cloning at load:** the first command after adding a `repo` project waits for the network.
- **An install that hangs** holds the spawn: `host.jobs.run` has no timeout. Not added, because the ticket does not ask for it.
- **The harness's MP tickets in the LB and LA boards.** The north and south `spec/build.json` hold MP tickets from the harness.
  - Under Arthur they would be listed and counted as LB's and LA's, while `MP…` ids resolve to preview (`board.ts` `owner`). New ids start at LB0001 and LA0001, because `lastNumber` filters by prefix.
  - This matters only at the switch, which is out of this ticket ("Arthur starts with an empty board"). Tests use temporary folders.
- **Three projects push `main` of one remote.** The local `main` branches differ today (preview 43b1a0c, north 42d9ec3, south 32782d7), each with its own tracked board. A merge in one and a push would collide with the others [INFERENCE: from the commit ids; the harness lives with the same layout today]. This is delivery's concern (54), not 41's.
- **Entry 84's install order.** The install of 41 must see nvm's `PATH`. The roadmap text makes "variables reach later prepares, nvm before projects" part of entry 84's Done means. Entry 41's install runs through `host.jobs.run` with no environment of its own, so 84 can extend it without a rewrite [INFERENCE].
- **`jobs.ts` and `testing.ts` are at 200 lines:** `checkout` moves out to its own file, and the edit to `testing.ts` is a comment only.
- **Readers not yet built:** the shapes of `coordinator.context` and `doctor` follow the text of entries 25 and 80.
- **Plugin boundary:** imports only `@arthur/core/plugin` and `@arthur/core/testing`; the structure test enforces it.

## How to test

- **The plan settles each point** (where the list lives, fields, MP, matching, context length, adding a project, doctor, migration): this document. The settled text goes into roadmap 41 and the doc page.
- **Option refusals** (`project-options` test), one test per refusal, each naming the project:
  - a missing name, prefix, or both or neither of `path` and `repo`;
  - a bad name or prefix;
  - a duplicate name, prefix or title, cross-key and without case (`ka` against `KA`);
  - one folder for two projects;
  - an `about` of 301 characters, with a line break, and exactly 300 accepted; a `title` of 61 characters;
  - an unknown key, with `pathPrepend` as the case;
  - a wrong type for each of `tracker`, `ci`, `commitRules` (zero or two forms), `autoMerge`, `requires`, `docker`, `install`;
  - `reposDir` missing with a `repo`, or inside home.
- **The MP case:** one bare repository cloned into three folders, declared as MP, LB and LA, loads. `host.board.create(…, "north")` writes `LB0001` into the north folder, even when that board already holds MP ids.
- **Clone** (real Git, a local bare repository as the URL):
  - a missing clone is made;
  - a bad URL refuses, naming the project, and leaves no folder;
  - another `origin` is refused, with its files unchanged;
  - the same `origin` is not cloned again;
  - a `path` without `.git` is refused;
  - two lockfiles with no `install` are refused, naming the files.
- **The list:** `fake.collect("projects")` gives absolute paths in config order.
- **Job runner:** `--project <second>` starts from that project's HEAD and records its name; an unknown name is refused, listing the names; the existing spawn tests pass with no list.
- **Install** (fake `npm` and `bun` on a test `PATH`, recording their arguments):
  - `install: "touch installed"` creates the file in the worktree;
  - `bun.lock` runs `bun install --frozen-lockfile`;
  - `install: ""` and no lockfile run nothing;
  - two lockfiles at base refuse the spawn;
  - an exit 1 refuses the spawn, naming the project and the command, and the worktree and record are gone;
  - a read-only kind also installs.
- **Context block:** header and lines in config order; `(name)` left out when equal to the title; no colon part without `about`.
- **`arthur projects` and `/projects`:**
  - lines, folder, open-ticket count (merged and dropped excluded) and install;
  - a hand-broken `spec/build.json` gives only that project an error line;
  - the phone reply equals the shell output.
- **Doctor:** `ok` with an `about`; non-critical `missing: no about`, with costs and fix, without one.
- **Roadmap and vision edits:** entries 41, 42 and 84, line 14, 25, 44, 80 and the Settings row read as in Approach. A grep for `pathPrepend` across the repository finds nothing outside `spec/features/`.
- **Smoke:** a temporary folder with an `arthur.config.ts` importing `packages/projects/src/projects.ts`, two real Git repositories and the fake agent. Run `arthur projects`, `arthur spawn --project <second> "…"` (the installed marker is present) and `arthur ticket new --project <second>`.
- **Checks:** `npm test` and `npm run check` pass, with the structure test holding the `projects` budget.

## Open questions

- **Entry 84, missing version:** when a project's `.nvmrc` names a Node that is not installed on the job's machine, should the spawn be refused, naming `nvm install <version>` (the plan's choice: no download during a spawn)? Or should the plugin run `nvm install` itself?
- **Entry 42, `.nvmrc` everywhere:** should `arthur init` add `.nvmrc` to a repository with no `package.json` (PHP, Python)? The plan follows your words literally and adds it to every repository, with the major version of the Node Arthur runs on.
