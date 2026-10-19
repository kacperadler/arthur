# arthur projects

Usage: `arthur projects`; on a channel `/projects`. Comes with the `projects` plugin.

Every project of the list, in config order, answered without the model; the shell and the channel get the same text. Each project's line is the one the coordinator reads (below), and under it its folder, its open tickets (every status but `merged` and `dropped`) and the install a new worktree gets:

```
SH Shop (web-shop): Online shop for garden tools; it succeeds when an order is paid.
  /srv/web-shop; 3 open tickets; install: npm ci
```

A board that cannot be read (`spec/build.json` broken by hand) gives that project `board unreadable: <error>` in place of its count; every other project is listed as usual.

Any argument is wrong usage: `usage: arthur projects` and exit code 2 in the shell, `usage: /projects` on a channel. A config or a plugin that does not load: exit code 1.

## The list

The projects are declared in `arthur.config.ts` and nowhere else, as the `list` option of the plugin; the first is the main one, which a command or a spawn without `--project` acts on. `arthur.config.ts` is ignored by Git, so the list stays on the machine. Adding a project is a few lines in the list, then `arthur projects` to see it:

```ts
projects({
	reposDir: "/srv/repos", // where `repo` projects are cloned; outside Arthur's home folder
	list: [
		{ name: "web-shop", title: "Shop", prefix: "SH", path: "/srv/web-shop", about: "Online shop for garden tools; it succeeds when an order is paid." },
		{ name: "docs", prefix: "DOC", repo: "git@example.com:acme/docs.git", install: "" },
	],
}),
```

Each entry:

- Required: `name` (lowercase letters, digits, dots and dashes; the folder name of a clone and the word `--project` takes), `prefix` (capital letters: the prefix of its ticket ids), and exactly one of `path` (its repository, which must exist with a `.git`) or `repo` (a Git URL, cloned into `reposDir/<name>`).
- `title`: the full name, one line of at most 60 characters; the name when left out.
- `about`: what the project is and what it is for, one line of at most 300 characters. Without it the coordinator knows the project only by its prefix, name and title, and `arthur doctor` says so (`projects <name> about: missing: no about`, not critical).
- `install`: the shell command that installs a new worktree's dependencies; `""` turns the install off.
- `prompts`: `{ vision?, criteriaDir?, rolesDir? }`, where the roles read the project's files, each a path inside its repository (not absolute, no `..` out of it): its vision (default `spec/vision.md`), its criteria folder (default `.agents/arthur/criteria`) and the folder of its role overrides (default `.agents/arthur/roles`). The core's prompt loader reads them (`arthur roles --help`); the coordinator reads each project's vision every turn (`arthur coordinator --help`).
- Read by other plugins, checked here for their shape only: `tracker` (`{ plugin, instance?, project }`), `ci` (`{ workflow }`), `commitRules` (exactly one of `{ regex }`, `{ words }`, `{ file }`), `autoMerge` (true or false), `requires` (`{ os?, arch?, tools? }`, the machine labels its jobs need, which the `machines` plugin places them by: `arthur machines --help`) and `docker` (true or false).

Relative paths, `path` and `reposDir`, count from the folder Arthur runs in. One repository may be declared several times, each checkout its own project with its own name, prefix and folder: a client branch is a checkout declared as its own project.

Refused at load, each refusal naming the project: a missing `name` or `prefix`; both or neither of `path` and `repo`; a name or prefix of other characters; any other key; a wrong type for a key; a `title` over 60 characters or an `about` over 300, or either with a line break; two projects with one name, prefix or title, compared without case and across the three (a name `shop` and a prefix `SHOP` are one word); two projects with one folder; a `path` that is not a folder or has no `.git`; a `repo` without `reposDir`, or `reposDir` inside Arthur's home folder; two known lockfiles and no `install`.

A missing clone is made at load: into a temporary name, renamed when whole, so a clone that fails names the project and leaves no folder. A folder there already that is a clone of another `origin` is refused and left as it is; one of the same `origin` is used as it is.

A project's repository without a board, `spec/build.json`, gets what Arthur reads from `arthur init <project>`: the vision and criteria skeletons, an `.nvmrc` and an empty board; then an onboarding job drafts its vision and criteria (`arthur init --help`). `arthur doctor` names each project without a board (`projects <name> board: missing: no spec/build.json`, not critical).

Each load that succeeds keeps the list's names and folders in `<home>/projects/checkouts`, a line `<name> <folder>` each, rewritten whole only when they changed. Every running job's worktree guard reads it on each tool call, so a project added to the list (and loaded, as by `arthur projects`) is refused to every other project's job at once, not from its next spawn.

## The coordinator's context

On every turn the coordinator reads one block: a line saying how it matches a word to a project, then one line per project in config order, `<prefix> <title> (<name>): <about>`, the `(<name>)` left out when it equals the title and the `: <about>` when there is none. The matching line: a prefix, name or title, in any case, names that project; a word found in only one project's title or about names it; a word that fits none or several makes the coordinator ask which, naming the candidates; an exact match comes first. A line is at most about 410 characters.

## Install

Every new worktree, of every kind of job, gets its dependencies before its agent starts, on the job's machine: the project's `install` when set, else the frozen install of the one known lockfile at the top of the commit the job starts from:

- `bun.lock`: `bun install --frozen-lockfile`
- `package-lock.json`: `npm ci`
- `pnpm-lock.yaml`: `pnpm install --frozen-lockfile`
- `composer.lock`: `composer install`
- `uv.lock`: `uv sync --frozen`

No lockfile and no `install`, or `install: ""`: nothing runs. `arthur continue` runs no install: the worktree keeps its spawn's. Two known lockfiles and no `install` refuse the spawn; an install that exits with another code than 0 refuses it too, naming the project, the command and its last line of output. A refused spawn leaves no worktree and no record. A tool an install needs must be on the `PATH` of Arthur's service (see `docs/setup.md`). The install runs with the `PATH` a prepare before it returned, when one did: with the nvm plugin listed before projects, the Node the project's `.nvmrc` names comes first on it (`packages/nvm/docs/nvm.md`).
