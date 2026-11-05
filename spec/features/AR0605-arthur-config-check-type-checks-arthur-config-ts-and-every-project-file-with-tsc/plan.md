# AR0605 - Plan

- Job: 2026-11-05-plan-287f8fd7
- Planned at: da29e52947f1c9d73871c4e4a13f5a7a17dfd104

## Approach
`arthur config check` gets one more step. Once `arthur.config.ts` has loaded, it runs `tsc` on the config and on each listed project's `project.config.ts`. tsc's own error lines are printed after the host's refusals and before the env lines, and any error makes the check fail (exit 1). Because tsc runs separately from the plugin load, a project file with two misspelt keys shows both errors in one run, next to the first plugin's refusal that the check already prints. I tested this on a throwaway copy: tsc printed both `'ulr' does not exist in type 'Site'` and `'ap' ...` in one run, in 0.3–0.5 s.

How it runs:
- **Which tsc.** It is found from the config's folder with `createRequire(<config>).resolve("typescript/package.json")` and run as `process.execPath <that folder>/bin/tsc`, with its working folder set to the config's folder. If typescript is not installed there (an install without dev dependencies), the check prints one line, `types not checked: typescript is not installed beside <config>; npm ci installs it with the dev dependencies`. That line does not fail the check, and the load and env checks run as before. No runtime dependency is added.
- **Which project files.** The core reads them from the config itself: the first valid plugin entry named `projects` that is not `enabled: false`, then each string in its `options.folders`, resolved from the folder Arthur runs in (as `readProjects` in `packages/projects/src/project-file.ts` resolves them), plus `project.config.ts`. A file that does not exist is skipped, because the projects plugin already refuses it at load.
- **Flags.** `--ignoreConfig --noEmit --pretty false --strict --target esnext --module nodenext --types node --allowImportingTsExtensions --skipLibCheck`. Each is needed:
  - Without `--ignoreConfig`, TS 7 stops with TS5112 when a `tsconfig.json` sits in the folder, which it does in the Arthur checkout.
  - Without `--types node`, TS 7 loads no Node types, so every package source that `@arthur/*` pulls in reports `node:fs` errors.
  - With these flags, the package sources check clean and only the config's and project files' errors are printed. On the live `/home/kacper/arthur` (config plus 3 project files), tsc exits 0 with these flags.
- **Output format.** tsc's own lines are printed as they are: `projects/landing/project.config.ts(3,87): error TS2353: ...`, which gives file, line, column and message, relative to the config's folder. A tsc that fails with no output prints one line naming its exit.
- **When the config does not load.** tsc does not run: there is no project list, and `loadConfig` already lists every core-shape problem.

Left alone:
- `arthur run`'s start check (doctor) and `arthur setup` (`readConfig`), which the Scope leaves out. See Open questions.
- The plugin API and the projects plugin.
- Collecting every plugin's load error in one run (out of Scope).
- The root `tsconfig.json`.
- `cli.ts`, which is already 209 lines.

This plan follows Option 1 under Not available directly.

## Not available directly
- **What is missing.** The core has no plugin-neutral way to get "each listed project file" when the load fails, and that is exactly the case this ticket is for. The list reaches the core only as the `collect("projects")` answer (`project-pieces.ts`, `host.ts:75,85,89`). That answer exists only inside a `loadPlugins` that succeeded; `cli.ts` `load()` drops it when a later plugin's `piece` check throws. The projects plugin's `<home>/projects/folders` file (`packages/projects/src/projects.ts:54-55`, read by `job-sandbox.ts:107`) is written only when `readProjects` succeeds, and not before the first run.
  - Option 1: the core reads the enabled `projects` entry's `options.folders` from the loaded config. Cost: about 6 lines in the core. Risk: the core knows one plugin's option name and its file name. It already knows the name `projects` and `project.config.ts` (`project-pieces.ts:38`).
  - Option 2: read `<home>/projects/folders`. Cost: about 4 lines. Risk: the list is stale or missing exactly when a project file is new or broken, which is the case the ticket targets.
  - Option 3: a new optional plugin member (e.g. `typeChecked(options)`) that the projects plugin answers from its options alone. Cost: plugin API plus `plugin-host.ts`, the projects plugin, its tests and `docs/plugin-api.md`. Risk: outside the ticket's Scope, and an abstraction built for one example.
  - Recommendation: Option 1.

## Files
- `packages/core/src/type-check.ts` (new, about 25 lines): `typeCheck(config: LoadedConfig): { lines: string[]; ok: boolean }`. It finds tsc (or returns the one "not installed" line with `ok: true`), lists the project files using `asPlugin` from `plugin-host.ts` the way `checkEnv` in `env.ts` filters entries, filters with `existsSync`, then calls `spawnSync` with `encoding: "utf8"`. It returns the non-empty lines of stdout and stderr, and `ok` when the exit status is 0.
- `packages/core/src/config-check.ts`: `configCheck` calls `typeCheck(config)` after `readConfig` and builds `lines = [...refused, ...types.lines, ...env.warnings, ...env.problems, ...variables]`, with `ok` also requiring `types.ok`. `readConfig` is unchanged, so `arthur setup` stays as it is. The header comment names AR0605.
- `packages/core/docs/commands/config.md`: describes the type check, under Usage and in the "Refused" list:
  - which files it checks (`arthur.config.ts` and each existing `<folder>/project.config.ts` of the enabled `projects` plugin's `folders`);
  - that tsc comes from the install beside the config;
  - tsc's line format, relative to the folder;
  - the "not installed" line, which does not fail;
  - that tsc does not run when the config does not load;
  - the exit code paragraph, saying a type error also gives 1.
- `packages/core/test/config-check.test.ts`: new tests (see How to test). The existing expectations gain the "not installed" line right after the refusals, because their bare temp folders have no typescript. That covers the `deepEqual` lists, the `lines[0]` on line 72 and the CLI stdout strings at lines 149 and 157-171.
- `packages/core/test/cli.test.ts`: the expected stdout at line 140 gains the same line.
- `test/structure.test.ts`: `BUDGETS.core` goes up by exactly the source lines added. The core is at its budget now (my count is 7210 of 7210; the structure test passes). The raise goes in the merge's outcome.md.

## Risks
- **Existing tests break.** Every config check in a bare temp folder now prints one more line. The worker updates each expectation listed under Files. Resolution starts from the config's folder, so the outcome does not depend on the repository's `node_modules`. If a developer's `TMPDIR` sits under a folder that has `node_modules/typescript`, tsc would be found there and the old-style untyped configs would fail under `--strict` `[INFERENCE]`. This does not happen with the kit's default `/tmp`.
- **An untyped hand-written config fails `--strict`.** For example `setup(host) {}` gives an implicit `any`. Real configs use the plugins' typed helpers, and the live config passes. The flags mirror the root `tsconfig.json`, so a config that `npm run check` would accept is accepted here.
- **tsc is missing or broken.** Missing: one line, and the check goes on, as Done means asks. `@types/node` missing while typescript is present: TS2688 is printed and the check fails. Both are the same dev-dependency install, so this should not happen in practice.
- **Speed.** Each `arthur config check` takes about 0.3–0.5 s longer (measured). tsc writes nothing (`--noEmit`), so the CLI's umask 077 has no effect on it.
- **tsc output reaching the screen.** Every line tsc prints reaches the user unfiltered. If option mismatches surfaced a package-source error it would show too, but with the flags above none do (checked against the repo's packages).
- **The core's line budget.** It is full, and the raise is planned explicitly, not hidden in a longer line.

## How to test
- **Every type error, with file and line, and exit 1; a project file with two misspelt keys shows both in one run.** New test in `config-check.test.ts`:
  - A temp folder with `node_modules` symlinked to the repository's.
  - `arthur.config.ts` with fake `orchestration` and fake `projects` entries (`options.folders: [<abs>/projects/landing]`), plus a fake plugin made by a typed helper defined inline, called with one misspelt option key.
  - `projects/landing/project.config.ts` using an inline typed helper (`type Site = { readonly url: string }`) with two misspelt keys (`ulr`, `ap`). No real plugin is imported, per the styleguide.
  - `configCheck(...)` returns `ok: false` and one line for each of the three errors, matched as `^arthur\.config\.ts\(\d+,\d+\): error TS\d+: .*'<key>'` and `^projects/landing/project\.config\.ts\(...'ulr'` / `'ap'`. Matched by pattern, not pinned to tsc's exact wording.
  - The same folder through the binary (`spawnSync(process.execPath, [CLI, "config", "check"], { cwd })`) exits 1 and prints both lines.
- **A correct config still exits 0.** Same layout with correct keys: no type lines, `ok: true`, and the binary exits 0.
- **Only listed files are checked.** A folder listed in `folders` with no `project.config.ts` adds no tsc line (no TS6053). A `projects` entry with `enabled: false`, or a `folders` that is not a list, checks only the config. A `project.config.ts` with errors in an unlisted folder gives no line.
- **No typescript: one line, and the check goes on.** A bare temp folder: exactly one `types not checked: ...` line, `ok` unchanged (`true` for `[${ORCHESTRATION}]`), and the env and refusal lines still printed. The existing tests updated with that line cover it too.
- **Full suite and type check.** `npm test` and `npm run check`, each in one bash call with `timeout` 1800, including `test/structure.test.ts` with the raised budget.
- **Smoke.** In a throwaway folder with a symlinked `node_modules`, run the repository's `packages/core/src/cli.ts config check` on a project file with two misspelt keys. Observe both lines next to the plugin refusal, then exit 1.

## Open questions
- The Description says "(and the check at `arthur run`'s start)" also runs tsc. Done means and Scope cover only `arthur config check`, and `arthur run`'s start check is the doctor (`run.ts:42`), which does not call `configCheck`. This plan leaves `arthur run` unchanged. Should a type error also refuse (or only warn at) the service's start? If so, that should be its own ticket.