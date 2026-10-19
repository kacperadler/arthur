# AR0196 - Review 1

- Job: 2026-10-19-review-ar0196-nvm-5cda617c
- Branch: h/2026-10-19-ar0196-nvm-52bdb90d
- Commit reviewed: e0fb946695cc99a375eed8e96840a86125a66cf6
- Verdict: PASS

## Final message

## Review: h/2026-10-19-ar0196-nvm-52bdb90d (bdfd8b1..e0fb946)

### Findings
None blocking.

### Notes (non-blocking)
- `packages/nvm/test/nvm.test.ts` / `test/option-tables.test.ts` (F1, disclosed by worker): nvm's options file isn't exercised through the shared `PLUGINS` table test because that test asserts a non-empty option table; nvm's `checkOptions` is still directly unit-tested in `nvm.test.ts`. Pre-existing test-harness limit, correctly logged as an open finding rather than hidden.
- `arthur config check` won't catch the nvm-after-projects order (it never runs plugin `setup`); worker states this as `[INFERENCE]` and it's accurate from reading `host.ts`'s `checkPlugins`. Not part of this ticket's Done means.
- `arthur continue` dropping nvm's `PATH` is explicitly out of scope (AR0190).

### Verification performed
- `npm ci`: clean, 14 packages.
- `npm run check`: no errors.
- `npm test`: 643/643 pass (full suite, ~249s).
- Mutation 1 — disabled the nvm-after-projects load refusal (`if (false && …)`): `packages/nvm/test/nvm.test.ts` catches it (1 failing: "listed after projects … nvm refuses the load").
- Mutation 2 — dropped `env.PATH` forwarding into the install script (`"" ` instead of `env.PATH ?? ""`): `packages/projects/test/install.test.ts` catches it (1 failing: "the install runs with the PATH a prepare before it returned …").
- Mutation 3 — core prepare chaining disabled (`fn(job, {})` instead of `fn(job, { ...env })`): both `packages/core/test/model.test.ts` and `packages/nvm/test/nvm.test.ts` / `packages/projects/test/install.test.ts` catch it (multiple failures, env no longer threaded).
- All mutated files restored (`git status --short` clean) before verdict.

### Spot checks against ticket/plan
- Roadmap entry 84 Delivers/Done means: `.nvmrc` read, `nvm which` on job's machine via `host.jobs.run`, bin folder first on `PATH`, install runs under it, doctor line per machine (never critical), each refusal (unreadable, empty/no-version, nvm missing, version not installed, timeout/other exit) — all present with matching tests and messages in `packages/nvm/src/nvm.ts` / `nvm.test.ts`.
- AR0184 goal (the `.nvmrc` `arthur init` writes is actually read): test uses `MAJOR = process.versions.node.split(".")[0]`, matching `arthur init`'s write convention; confirmed end-to-end via spawn + agent PATH capture.
- Follow-up decision (2026-10-19): `packages/projects/src/install.ts` now takes `(job, env)` and runs the install with `env.PATH ?? ""`, with a dedicated test proving the npm-under-nvm-Node case and the plain fallback — matches exactly.
- Follow-up decision (order refusal): `nvm.ts` setup throws `nvm is listed after projects, whose install would then run before nvm's PATH exists; list nvm() before projects in the plugins of arthur.config.ts` when `host.collect("projects").length > 0`; tested both directions in `nvm.test.ts`.
- Core hook change (`Prepare` now `(job, env)`): backward-compatible with every existing single-arg `prepare` registration (orchestration/session/models/projects/tests) — `npm run check` confirms no type breakage; `model.test.ts` updated to assert the new chaining semantics without re-pinning unrelated behavior.
- Budgets: `nvm` 84 = 16 (`nvm-options.ts`) + 68 (`nvm.ts`) exactly; `projects` 475 = 473 + 2, matching `install.ts` growing 41→43 lines. Comment in `test/structure.test.ts` names what changed and why, per styleguide.
- Boundaries: nvm imports only `@arthur/core/plugin` and `@arthur/core/option-table`; it never imports the `projects` package — it checks order via `host.collect("projects")`, the host API, not a direct plugin-to-plugin reach. No plugin reads/writes another plugin's `.arthur/` folder.
- Docs: `nvm.md` (new), `projects.md`, `spawn.md`, `setup.md`, `deploy.md`, `arthur.config.example.ts`, README table/`arthur.mmd` all updated consistently with the behavior; README/`arthur.mmd` mark 84 as built.
- Shape rules: no runtime deps in `packages/nvm/package.json`, no `index.ts`/`types.ts`/`utils.ts`, no classes/enums, plain functions, files well under 200 lines.
- No secrets, no non-English text, nothing binds a public address, no production-named test resources (each test uses `temporaryFolder()`/fake ssh/fake nvm).

Everything the worker's final message claims (checks, files, line budgets, behavior) reproduces exactly as described.

PASS
