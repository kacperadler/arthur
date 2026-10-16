# AR0063 - Review 1

- Job: 2026-10-16-review-ar0063-providers-8986b048
- Branch: h/2026-10-16-ar0063-providers-and-fal-c8dd47f8
- Commit reviewed: 1bbfd017bc10de241696f82f247f7a7289c6412c
- Verdict: PASS

## Final message

Confirmed exact. All claims check out.

Everything verified: roadmap entry 82 placed correctly, Order paragraph updated consistently, entry 80's doctor list extended, new `## Models` section with full Package/Delivers/Done-means/Depends-on/Size/Covers in the existing shape. Cross-checked against omp's actual docs (`providers.md`, `models.md`, `environment-variables.md`):

- `OLLAMA_BASE_URL`/`LM_STUDIO_BASE_URL` env-var claims match the Built-in local engines table exactly.
- `models.yml` location (`~/.omp/agent/` only, no per-project override) matches "Config file location" section — worker's claim that a per-job `models.yml` is impossible holds.
- `PI_CODING_AGENT_DIR` relocation claim matches auth-storage note.
- LM Studio's generic OpenAI-compatible `/models` discovery (works for any compatible server) matches the doc's explicit note about non-LM-Studio servers.
- Tailscale/private/loopback CIDR ranges given (100.64.0.0/10, fd7a:115c:a1e5::/48, `*.ts.net`) are the real Tailscale ranges — accurate, not fabricated.

All ticket Done-means items are present in the delivered entry text (providers option shape + url restriction, ordered-model fallback via `roles.model`/`models.pick`, job record naming chosen model and reason, free model keeping time limit but no budget stop, mid-job loss failing not switching, doctor requirements with non-critical-when-fallback-exists, and every edge case listed: all-unavailable refusal, slow probe cutoff, provider list missing model, key reaching only header/env, one cached probe per 30s window for concurrent spawns, explicit `--model` refused with no fallback per the ticket's Decision).

`arthur.config.example.ts` change matches Done means exactly: a `mac` provider and `worker.model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"]`; internally consistent with the existing `machines()` block's `mac`/`mac-mini` entry.

Numbering integrity: diff only inserts new text (Order paragraph sentence, one appended clause in entry 80, two brand-new sections); no existing entry 1-81 heading or body was renumbered or otherwise altered. Verified via the full diff — no stray hunks elsewhere.

Scope: diff touches only `spec/roadmap.md`, `arthur.config.example.ts`, and the ticket's own `findings.md` (process file, not product scope) — matches ticket's Scope (`In: spec/roadmap.md, arthur.config.example.ts`). The one addition beyond ticket's literal scope — F1 finding about vision.md/diagrams — is correctly logged as an open finding rather than silently fixed or silently ignored, and the worker's final message is transparent about it.

Core-change notes in entry 82's Package line (`model` may be a list, `roles.model` may return a promise, `jobs.prepare` may return env vars, `jobs.run(machine, argv)`) cross-checked against entry 70's Package line, which independently names the same `prepare`/`run` additions — consistent, no contradiction. Verified the "model picked before `beforeSpawn`" claim directly in `packages/core/src/jobs.ts:123` (`roleModel(...)`) vs `:127` (`beforeSpawn` loop) — exact line match.

`npm run check`: `tsc` exit 0 (reproduced). `npm test`: 243/243 pass, 0 fail (reproduced) — matches worker's claim exactly.

Notes (non-blocking):
- F1 (models plugin missing from vision.md/diagrams) is correctly scoped out and logged, not a defect in this diff.
- Worker's own observation about omp's keyless-vs-`OLLAMA_API_KEY` doc wording is a minor doc nit in omp itself, not actionable here.

PASS
