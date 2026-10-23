# AR0039 - `arthur config check` says ok when a plugin's `setup` refuses the start

```json
{
  "id": "AR0039",
  "title": "`arthur config check` says ok when a plugin's `setup` refuses the start",
  "date": "2026-10-16"
}
```

## Description

`configCheck` runs the host's checks before `setup` only, as AR0031 asks, so a refusal raised in `setup` (a plugin registering a command name the core or another plugin holds, or a plugin's own `setup` throwing) is not in its lines, and the check exits 0 while `arthur run` refuses to start. The binary already ran every `setup` in `load()` before the `config` command runs (`cli.ts:54`), so the refusal is known as `problem` but `config check` does not print it; `arthur help` does. Reproduced: a config whose only plugin is `orchestration` with a `setup` that registers a command named `config`; `arthur config check` prints `no enabled plugin names an env variable` and exits 0, `arthur help` prints `plugin orchestration: setup failed: command config: registered by core and by orchestration; a command belongs to one plugin`.

## Goal

`arthur config check` is the one place a human learns whether `arthur run` will start. The binary already runs every `setup` in `load()` before any command, so a setup refusal is already known as `problem`; config check prints it and exits 1 instead of saying ok.

- Kind: feat

Evidence:
- `packages/core/src/cli.ts:49` (`load`) and `packages/core/src/cli.ts:73`
- Found by: 2026-10-16-ar0031-config-check-host-63e14b42 (worker), 2026-10-16

## Done means

- `arthur config check` prints the load's `problem` (a setup refusal: a command name already held, a `setup` that throws) after the host-refusal lines, and exits 1; `ok` only with no problem at all.
- A test reproduces F1's case (only `orchestration`, whose `setup` registers `config`) and a throwing `setup`: both exit 1 and name the plugin; a clean config still prints ok and exits 0.
- `docs/commands/config.md` says setup refusals are reported, and that the check runs each plugin's `setup` as every `arthur` command does.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/cli.ts`, `config-check.ts`, their tests, `docs/commands/config.md`.

Out:
- Making `load()` setup-free.

## Decisions

- 2026-10-16: Source: F1 of AR0031
- 2026-10-16: Coordinator: report the load's problem (option 1): setup already runs on every command, so a setup-free check would only hide a known refusal.
