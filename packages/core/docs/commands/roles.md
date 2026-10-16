# arthur roles

Usage: `arthur roles [--project <name>]`

Prints every role, its model, and the files its prompt reads, in the order the prompt has them. This page is also what the models of Arthur's jobs read, and where it comes from.

## What a job's agent reads

Each kind of job names a role (`worker` for the kind `worker`; a plugin's kinds name its roles, for example `reviewer`). The plugin that owns the role registers it with `host.jobs.registerRole({ name, file, criteria })`; the core owns `worker`. When a job is spawned, its prompt is built in this order and kept in the job record as `<home>/jobs/<id>/prompt`:

1. The role file the plugin ships (`file`). The core's worker role is `packages/core/roles/worker.md`: how a worker works, its Never list, its final message.
2. The project's own override of the role, `.agents/arthur/roles/<role>.md`, under the heading `## Project override, which wins over the role above (<path>)`. A project without one for a role adds nothing: one role may have an override and another none.
3. Each criteria file the role names (`criteria`), `.agents/arthur/criteria/<name>.md`, as `## <title> (<path>)` followed by the file; the title is the file's first `# ` heading, else its name. The worker reads `styleguide`.
4. The sections other plugins add for that role and job, each a provider of `prompt` called with the role's name and the job (for example a project's commit rules, a tracker's rules), in setup order. A provider returns text, or undefined for none.

The task itself is not part of the prompt; it is the record's `task`. The project's files (2 and 3) are read from the job's worktree, so they are those of HEAD: an uncommitted change to a criteria file is not read. Their folders are relative to the project's repository.

Model and thinking level: from the one plugin that provides `roles.model` (the coordinator's `roles` option), called with the role's name and answering `{ model, thinking }`, each a string or undefined; without one, the agent's own default. `arthur spawn --model` and `--thinking` win over the role's.

## The spawn

- A role whose file is missing refuses the spawn, before any worktree or record exists: `role <role>: its role file <path> is missing`. So does a kind whose role no plugin registered: `role <role> is not registered; roles: <roles>`.
- A criteria file that is missing warns and the job starts without it: `criteria file <path> is missing; the <role> goes without it`. A project without a criteria folder gets that warning for each file its role names. An empty criteria file adds nothing and warns: `criteria file <path> is empty; nothing added`. `arthur spawn` prints each warning on stderr as `warning: <text>`; `host.jobs.spawn` returns them as the job's `warnings`.
- An override or criteria file that is a symlink, or lies under a symlinked folder, is never read: the spawn is refused with `<path> is a symlink; refused, the roles read a project's file only as a plain file`, and the job's worktree and record are removed. So is one that is not a plain file (`<path> is not a file`). A symlink could make the prompt carry whatever it points at, a secrets file included.
- A provider of `prompt` that returns anything but text or undefined refuses the spawn: `a plugin's prompt section must be text, got <type>`. Two providers of `roles.model`, or a model or thinking level that is not a non-empty string, refuse it too.

## The output

One block per role, in the order the roles were registered, the core's `worker` first:

```
worker: model the agent's default, thinking the agent's default; kinds worker; from core
  role     /srv/arthur/packages/core/roles/worker.md
  override .agents/arthur/roles/worker.md  none
  criteria .agents/arthur/criteria/styleguide.md
```

The first line: the role, its model and thinking level, the kinds that use it, and the plugin that registered it. Then one line per file, in the prompt's order: the role file by its absolute path, the project's files relative to the project. A file that is read as it is has nothing after its path; otherwise: `missing: a spawn is refused` (a role file), `none` (no override), `missing: a spawn warns and starts without it` (a criteria file), `empty: adds nothing`, `a symlink: never read, a spawn is refused`, `not a file: never read, a spawn is refused`.

The project's files are looked up in the main checkout's working tree, so an uncommitted file shows here before a job reads it. The sections plugins add through `prompt` depend on the job and are not listed.

`--project <name>`: the project; until a plugin adds projects, the only one is the main repository, named by its folder (`unknown project <name>; the only project is <name>` otherwise).

Exit code 0 when the list is printed; 1 when `arthur.config.ts` or a plugin does not load (the roles are what the plugins registered), or on an unknown project; 2 on any argument.
