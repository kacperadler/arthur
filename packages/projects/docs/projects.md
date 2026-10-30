# The projects plugin

One folder per project, named in `arthur.config.ts`: each holds that project's `project.config.ts`, everything about the project for every plugin in one place, and may hold its own vision and criteria. The project's own piece, `projects.project(...)`, gives its checkout or the repository Arthur clones, its ticket prefix, its install and where its vision and criteria live; each other plugin's helper makes that plugin's piece (`youtrack.project(...)`, `uptime.project(...)`, `github.project(...)`), which that plugin reads and checks. Accounts and tokens stay in each plugin's own section of `arthur.config.ts`. Each new worktree gets the project's install before its job starts, and `arthur init` onboards a new repository.

```ts
// arthur.config.ts
projects({ reposDir: "../repos", folders: ["projects/shop"] }),

// projects/shop/project.config.ts
import { projects } from "@arthur/projects";
export default [projects.project({ title: "Shop", about: "The online shop for garden tools.", repo: "git@github.com:acme/shop.git", prefix: "SH" })];
```

## Options

- `folders`: the project folders, the first the main one, which a command without `--project` acts on; relative to the folder Arthur runs in. Each folder's name is its project's name (a clone's folder name and the word `--project` takes), and each holds its `project.config.ts`. Keep them beside `arthur.config.ts` (`projects/<name>/`), where a project file's `@arthur/*` imports resolve; `projects/` is ignored by Git, as `arthur.config.ts` is.
- `reposDir`: where `repo` projects are cloned, outside Arthur's home folder; relative to the folder Arthur runs in.

A project file's own piece, `projects.project({ ... })`: a `prefix` for its ticket ids, and a `path` (a folder with a `.git`, relative to the project's folder) or a `repo` (a Git URL, cloned into `reposDir/<name>` at load when missing). Optional: `title` (default its name), `about` (what it is and is for, which the coordinator reads), `install` (the command that installs a new worktree's dependencies, `""` for none; default the frozen install of its one known lockfile), and `prompts` (`{ vision?, criteriaDir?, rolesDir? }`, each a path inside the project's folder; default `spec/vision.md`, `.agents/arthur/criteria`, `.agents/arthur/roles` in its repository).

`arthur projects` (`/projects` on a channel) shows the projects; `arthur projects --help` holds each key in full. Each command's page, what `arthur <command> --help` prints, is in [`commands/`](commands/).
