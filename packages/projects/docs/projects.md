# The projects plugin

The project list, declared in `arthur.config.ts` and nowhere else: each project's folder or the repository Arthur clones, its ticket prefix, its tracker, its CI workflow, its commit rules, auto-merge, the machine labels its jobs need, and where its vision and criteria live. Other plugins read their own key of each project (`tracker` the tracker's, `ci` github's, `commitRules` commit-rules', `autoMerge` delivery's). Each new worktree gets the project's install before its job starts, and `arthur init` onboards a new repository.

```ts
projects({
	reposDir: "../repos",
	list: [{ name: "shop", title: "Shop", about: "The online shop for garden tools.", repo: "git@github.com:acme/shop.git", prefix: "SH" }],
}),
```

## Options

- `list`: the projects, the first the main one, which a command without `--project` acts on. Each has a `name` (a clone's folder name and the word `--project` takes) and a `prefix` for its ticket ids, and lives at a `path` (a folder with a `.git`) or a `repo` (a Git URL, cloned into `reposDir/<name>` at load when missing). Optional: `title` (default its name), `about` (what it is and is for, which the coordinator reads), `install` (the command that installs a new worktree's dependencies, `""` for none; default the frozen install of its one known lockfile), `tracker` (`{ plugin, instance?, project }`), `ci` (`{ workflow }`), `commitRules` (one of `{ regex }`, `{ words }`, `{ file }`), `autoMerge`, `requires` (`{ os?, arch?, tools? }`), `docker`, and `prompts` (`{ vision?, criteriaDir?, rolesDir? }`; default `spec/vision.md`, `.agents/arthur/criteria`, `.agents/arthur/roles`).
- `reposDir`: where `repo` projects are cloned, outside Arthur's home folder; relative to the folder Arthur runs in.

`arthur projects` (`/projects` on a channel) shows the list; `arthur projects --help` holds each key in full. Each command's page, what `arthur <command> --help` prints, is in [`commands/`](commands/).
