# arthur roles

Usage: `arthur roles [--project <name>]`

Prints every role, its model, and the files its prompt reads, in the order the prompt has them. This page is also what the models of Arthur's jobs read, and where it comes from.

## What a job's agent reads

Each kind of job names a role (`worker` for the kind `worker`; a plugin's kinds name its roles, for example `reviewer`). The plugin that owns the role registers it with `host.jobs.registerRole({ name, file, criteria })`; the core owns `worker`. When a job is spawned, its prompt is built in this order and kept in the job record as `<home>/jobs/<id>/prompt`:

1. The role file the plugin ships (`file`). The core's worker role is `packages/core/roles/worker.md`: how a worker works, its Never list, its final message.
2. The project's own override of the role, `<rolesDir>/<role>.md`, under the heading `## Project override, which wins over the role above (<path>)`. A project without one for a role adds nothing: one role may have an override and another none.
3. Each criteria file the role names (`criteria`), `<criteriaDir>/<name>.md`, as `## <title> (<path>)` followed by the file; the title is the file's first `# ` heading, else its name. The worker reads `styleguide`.
4. The sections other plugins add for that role and job, each a provider of `prompt` called with the role's name and the job (for example a project's commit rules, a tracker's rules), in setup order. A provider returns text, or undefined for none.

The task itself is not part of the prompt; it is the record's `task`. The project's files (2 and 3) are read from the job's worktree, so they are those of HEAD: an uncommitted change to a criteria file is not read.

Where a project keeps them: `rolesDir` (default `.agents/arthur/roles`), `criteriaDir` (default `.agents/arthur/criteria`) and `vision` (default `spec/vision.md`, the project's vision), each relative to the project's repository, set per project by its `prompts` key in the `projects` plugin's list. A path that is absolute or leads out of the repository (`..`) is refused before anything is read: `project <name>: prompts.<key>: expected vision, criteriaDir, rolesDir, each a path inside its repository, got <path>`; so is any other key.

Outside a spawn a plugin reads a role through `host.jobs.prompt(role, project?)`: the same prompt (1 to 3) from the project's main checkout, without the sections of 4, which belong to a job, with the same warnings and refusals; and the project's vision through `host.jobs.vision(project?)`: `{ project, path, text }`, or `problem` (`missing`, `a symlink`, `not a file`) instead of `text`, never read through a symlink. Left out, the project is the main one. The orchestration plugin reads the coordinator's role and each project's vision so, every turn (`arthur coordinator --help`). `host.jobs.criteria()` gives the names of the criteria files the registered roles read, each once, in the order the roles were registered (`["styleguide", "autopilot"]`); `arthur init` writes a skeleton of each.

Model, thinking level and quick model: from the one plugin that provides `roles.model` (orchestration's `roles` option; for the role `coordinator`, its `coordinator.model` and `coordinator.thinking`), called with the role's name and answering `{ model, thinking, quick }`, or a promise of it, awaited, each a string or undefined, `model` also an ordered list; without one, the agent's own default. A list is shown as written, `model mac/qwen3-coder, anthropic/claude-haiku-5-5`, and nothing is probed: a spawn has the models plugin pick from it (`arthur spawn --help`, "The model"). The quick model goes to the agent as `--smol`. `arthur spawn --model` and `--thinking` win over the role's.

## The spawn

- A role whose file is missing refuses the spawn, before any worktree or record exists: `role <role>: its role file <path> is missing`. So does a kind whose role no plugin registered: `role <role> is not registered; roles: <roles>`.
- A criteria file that is missing warns and the job starts without it: `criteria file <path> is missing; the <role> goes without it`. A project without a criteria folder gets that warning for each file its role names. An empty criteria file adds nothing and warns: `criteria file <path> is empty; nothing added`. `arthur spawn` prints each warning on stderr as `warning: <text>`; `host.jobs.spawn` returns them as the job's `warnings`.
- An override or criteria file that is a symlink, or lies under a symlinked folder, is never read: the spawn is refused with `<path> is a symlink; refused, the roles read a project's file only as a plain file`, and the job's worktree and record are removed. So is one that is not a plain file (`<path> is not a file`). A symlink could make the prompt carry whatever it points at, a secrets file included.
- A provider of `prompt` that returns anything but text or undefined refuses the spawn: `a plugin's prompt section must be text, got <type>`. Two providers of `roles.model`, a model that is not a non-empty string or a non-empty list of them, or a thinking level or quick model that is not a non-empty string, refuse it too.

## The output

One block per role, in the order the roles were registered, the core's `worker` first; the coordinator's role (`coordinator`, from orchestration) is listed with no kind, since `arthur run` starts it and no spawn does:

```
worker: model the agent's default, thinking the agent's default, quick model the agent's default; kinds worker; from core
  role     /srv/arthur/packages/core/roles/worker.md
  override .agents/arthur/roles/worker.md  none
  criteria .agents/arthur/criteria/styleguide.md
```

The first line: the role, its model and thinking level, the kinds that use it, and the plugin that registered it. Then one line per file, in the prompt's order: the role file by its absolute path, the project's files relative to the project. A file that is read as it is has nothing after its path; otherwise: `missing: a spawn is refused` (a role file), `none` (no override), `missing: a spawn warns and starts without it` (a criteria file), `empty: adds nothing`, `a symlink: never read, a spawn is refused`, `not a file: never read, a spawn is refused`.

The project's files are looked up in the main checkout's working tree, so an uncommitted file shows here before a job reads it. The sections plugins add through `prompt` depend on the job and are not listed.

`--project <name>`: the project, a name in the list of the `projects` plugin; its main checkout is the project's folder there, and left out, the first in the list (`unknown project <name>; projects: <names>` otherwise). Without the projects plugin, the only project is the main repository, named by its folder (`unknown project <name>; the only project is <name>` otherwise).

Exit code 0 when the list is printed; 1 when `arthur.config.ts` or a plugin does not load (the roles are what the plugins registered), or on an unknown project; 2 on any argument.
