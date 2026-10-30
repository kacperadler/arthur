# arthur projects

Usage: `arthur projects`; on a channel `/projects`. Comes with the `projects` plugin.

Every project, in the order of `folders`, answered without the model; the shell and the channel get the same text. Each project's line is the one the coordinator reads (below), and under it its folder, its open tickets (every status but `merged` and `dropped`) and the install a new worktree gets:

```
SH Shop (web-shop): Online shop for garden tools; it succeeds when an order is paid.
  /srv/web-shop; 3 open tickets; install: npm ci
```

A board that cannot be read (`spec/build.json` broken by hand) gives that project `board unreadable: <error>` in place of its count; every other project is listed as usual.

Any argument is wrong usage: `usage: arthur projects` and exit code 2 in the shell, `usage: /projects` on a channel. A config or a plugin that does not load: exit code 1.

## The project folders

Each project has a folder of its own, named in the `folders` option of the plugin in `arthur.config.ts`; the first is the main one, which a command or a spawn without `--project` acts on. The folder's name is the project's name: lowercase letters, digits, dots and dashes, from a letter or digit; the folder name of a clone and the word `--project` takes. Each folder holds the project's `project.config.ts`, and may hold the project's own vision and criteria. `projects/` is ignored by Git, as `arthur.config.ts` is, so the projects stay on the machine. Adding a project is one folder and one line in `folders`, then `arthur projects` to see it:

```ts
// arthur.config.ts: the accounts once, in each plugin's own section, and the project folders
projects({ reposDir: "/srv/repos", folders: ["projects/web-shop", "projects/docs"] }),

// projects/web-shop/project.config.ts: everything about this project, each piece made by its plugin's helper
import { projects } from "@arthur/projects";
import { uptime } from "@arthur/uptime";
export default [
	projects.project({ title: "Shop", prefix: "SH", path: "/srv/web-shop", about: "Online shop for garden tools; it succeeds when an order is paid." }),
	uptime.project([{ url: "https://shop.example/" }]),
];

// projects/docs/project.config.ts
import { projects } from "@arthur/projects";
export default [projects.project({ prefix: "DOC", repo: "git@example.com:acme/docs.git", install: "" })];
```

## A project's file

`project.config.ts` has a default export: the project's pieces, a list, each made by a plugin's helper, which only returns `{ <plugin>: <value> }`. Exactly one is `projects.project({ ... })`, this plugin's; at most one per plugin. Every other piece is its plugin's to read and to check at load (its `piece`, `docs/plugin-api.md`): `youtrack.project(...)`, `github.project(...)`, `commitRules.project(...)`, `delivery.project(...)`, `machines.project(...)`, `uptime.project(...)`, `findings.project(...)`. A piece no loaded plugin reads, a disabled plugin's or a key written by hand, is a line of `arthur doctor`, not a refusal (`arthur doctor --help`).

`projects.project({ ... })`:

- Required: `prefix` (capital letters: the prefix of its ticket ids), and exactly one of `path` (its repository, which must exist with a `.git`) or `repo` (a Git URL, cloned into `reposDir/<name>`).
- `title`: the full name, one line of at most 60 characters; the name when left out.
- `about`: what the project is and what it is for, one line of at most 300 characters. Without it the coordinator knows the project only by its prefix, name and title, and `arthur doctor` says so (`projects <name> about: missing: no about`, not critical).
- `install`: the shell command that installs a new worktree's dependencies; `""` turns the install off.
- `prompts`: `{ vision?, criteriaDir?, rolesDir? }`, where the roles read the project's files, each a path inside the project's folder (not absolute, no `..` out of it), read there at its real path: its vision, its criteria folder and the folder of its role overrides. Left out, each is read from the job's worktree, as committed in its repository: `spec/vision.md`, `.agents/arthur/criteria` and `.agents/arthur/roles`. The core's prompt loader reads them (`arthur roles --help`); the coordinator reads each project's vision every turn (`arthur coordinator --help`). `arthur init` and the onboarding write only repository files, so they refuse a project whose `prompts` names its folder's: write those files yourself.

`path` counts from the project's folder, `folders` and `reposDir` from the folder Arthur runs in. Keep the folders beside `arthur.config.ts`: a project file's `@arthur/*` imports resolve only from under Arthur's folder. One repository may be declared several times, each checkout its own project with its own folder, prefix and checkout: a client branch is a checkout declared as its own project.

Refused at load, each refusal naming the folder or the file: a folder name of other characters, or two folders with one name (`folders[<i>]: ...`); a missing `project.config.ts`, one that does not load, or a default export that is no list; a piece that is not an object of exactly one key; a second piece of one plugin; no `projects.project(...)`; in it, a missing `prefix`, both or neither of `path` and `repo`, a prefix of other characters, any other key (`name` among them: the folder names the project), a wrong type for a key; a `title` over 60 characters or an `about` over 300, or either with a line break; two projects with one name, prefix or title, compared without case and across the three (a name `shop` and a prefix `SHOP` are one word); two projects with one checkout; a `path` that is not a folder or has no `.git`; a `repo` without `reposDir`, or `reposDir` inside Arthur's home folder; two known lockfiles and no `install`. An old `list` option is an unknown option. A refusal reads `<file>: projects.project(...).<key>: <problem>`.

A missing clone is made at load: into a temporary name, renamed when whole, so a clone that fails names the project and leaves no folder. A folder there already that is a clone of another `origin` is refused and left as it is; one of the same `origin` is used as it is. These refusals print each URL without its user and password, and git's own line with any word holding an `@` replaced by `the repo`, so they show no credential a URL holds; SSH or git's credential helper keeps it out of the config too.

A project's repository without a board, `spec/build.json`, gets what Arthur reads from `arthur init <project>`: the vision and criteria skeletons, an `.nvmrc` and an empty board; then an onboarding job drafts its vision and criteria (`arthur init --help`). `arthur doctor` names each project without a board (`projects <name> board: missing: no spec/build.json`, not critical).

Each load that succeeds keeps the projects' names and checkouts in `<home>/projects/checkouts`, a line `<name> <checkout>` each, rewritten whole only when they changed. Every running job's worktree guard reads it on each tool call, so a project added (and loaded, as by `arthur projects`) is refused to every other project's job at once, not from its next spawn.

## The coordinator's context

On every turn the coordinator reads one block: a line saying how it matches a word to a project, then one line per project in the order of `folders`, `<prefix> <title> (<name>): <about>`, the `(<name>)` left out when it equals the title and the `: <about>` when there is none. The matching line: a prefix, name or title, in any case, names that project; a word found in only one project's title or about names it; a word that fits none or several makes the coordinator ask which, naming the candidates; an exact match comes first. A line is at most about 410 characters.

## Install

Every new worktree, of every kind of job, gets its dependencies before its agent starts, on the job's machine: the project's `install` when set, else the frozen install of the one known lockfile at the top of the commit the job starts from. The plugin hands the command to the job as its variable `ARTHUR_INSTALL`, and the job's wrapper runs it as its first step, in the worktree, inside the job's scope and the job's sandbox (`arthur spawn --help`, "The sandbox"), so the lifecycle scripts read neither the env file nor Arthur's environment, it writes only where the job's agent may and in the package managers' caches, and the job's caps hold the install and the lifecycle scripts its dependencies run (`preinstall`, `postinstall`, `prepare`; they stay on, since a project's build needs them), and what they leave running is killed at the job's end:

- `bun.lock`: `bun install --frozen-lockfile`
- `package-lock.json`: `npm ci`
- `pnpm-lock.yaml`: `pnpm install --frozen-lockfile`
- `composer.lock`: `composer install`
- `uv.lock`: `uv sync --frozen`

No lockfile and no `install`, or `install: ""`: nothing runs. `arthur continue` runs no install: the worktree keeps its spawn's. Two known lockfiles and no `install` refuse the spawn, which leaves no worktree and no record. An install that exits with another code than 0 ends the job at once, before any agent starts, ``failed: the agent did not start: install `<command>` exited <code>: <its last line of output>``; its worktree and branch are kept, and its output is in the job's `log`, after the line `install: <command>`. An `arthur stop`, or the job's time or memory limit, during the install stops it and starts no agent. The install's time limit is the job's timeout (`timeoutMinutes`, or `--timeout`; `arthur spawn --help`, its "Limits"), counted from the wrapper's start: past it the install is stopped as the agent would be, its log saying `limit: time: stopping the install`, and the job ends `limit: time: the job ran past its timeout of <minutes> minutes, during its install`; a timeout of 0, no limit, leaves an install that never returns running until `arthur stop`. A tool an install needs must be on the `PATH` of Arthur's service (see `docs/setup.md`). The install runs with the `PATH` the prepares returned: with the nvm plugin loaded, the Node the project's `.nvmrc` names comes first on it (`packages/nvm/docs/nvm.md`).

The same install, of a project at a commit, is provided to other plugins as `projects.install`: `arthur merge` runs it on main after a merge (`arthur merge --help`).
