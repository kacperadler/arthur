# AR0614 - Plan

- Job: 2026-11-03-plan-dc48b7b1
- Planned at: 4a8e15bd862c1f2bb2fdedb02406081f40b3a495

## Approach
Add two `session` options: `compactOn`, which picks the trigger, and `compactAtPercent`, which sets the threshold. The coordinator's turn extension records how full the context is at the end of each turn. On its existing 500 ms tick, `arthur run` reads that number and decides whether to compact. A compaction started this way writes the same `request.json` as a scheduled one. So the handoff-first step, the withdrawal after a failed write, the `compactWaitSeconds` wait, the read-back and the outcome lines all come from code that already exists. `handoff-extension.ts` does not change.

- **Where the context use comes from (Done means 3).** OMP 18.3.0 has the number. In its extension runner, `createContext` (strings of `/home/kacper/.local/bin/omp`, about line 717957) gives every event handler's `ctx` a `getContextUsage()`. It returns `{ tokens, contextWindow, percent }` or `undefined`. The source is the session's `getContextUsage` (about line 620784): `percent = usedTokens / contextWindow * 100`, and 0 when the window is unknown. It is computed from the last assistant message's usage and rebased after a compaction (`rebaseAfterCompaction`). OMP's own changelog line says: "`ctx.getContextUsage()` and `ctx.compact()` operate on the child session". `ctx.compact()` from that same object is what `handoff-extension.ts` already calls.
- **Options** (`session-options.ts`):
  - `compactOn`: `"schedule"` (the default, today's behaviour), `"context"` or `"both"`.
  - `compactAtPercent`: a whole number from 1 to 99. Default 80, which OMP's own setting labels "Typical threshold"; see Open questions.
  - Both are checked by the existing generic `checkOptions` loop. Bad values are refused as `compactOn: expected "schedule", "context" or "both", got <value>` and `compactAtPercent: expected a whole number from 1 to 99, got <value>`.
- **Agent side** (`turn-extension.ts`). At each real end of a coordinator turn (`ctx.hasUI`, `willContinue !== true`, before the failure logic, aborted turns included), it writes the percent as plain text to `<home>/session/context-use`. It writes to a temporary name and then renames, like `agent` and `handoff-read`. It writes only when `ctx.getContextUsage?.()` returns a `contextWindow > 0` and a finite percent. The call is optional so that the fake agent and an OMP without this API simply give no report.
- **`arthur run` side** (`compactions()` in `session.ts`):
  - At the start, `context-use` is removed together with `request.json`, so a report from an earlier run does not count.
  - Each tick reads `context-use` and then removes it, so each report is acted on once.
  - The trigger has an `armed` flag that starts true. A report at or above `compactAtPercent` while armed, with no request pending, writes a compact request with slot `context <n>%` and the usual `waitSeconds: compactWaitSeconds`, then clears `armed`.
  - It is armed again only by a `compact: done…` outcome (from either trigger), or by a report below the threshold (for example after a fresh start, OMP's own compaction, or a `/compact` the owner typed). A repeated crossing before the compaction therefore asks once, and nothing fires again until the conversation has been compacted.
  - With `"context"`, the schedule is replaced by an empty `compactAt`, so `upcoming()` gives none. With `"schedule"`, the report is read, removed and ignored.
  - With `"both"`, whichever comes first asks. The existing rule (never queue a second request while one is pending) holds across both triggers.
- **Room for project agents (Done means 4).** All the trigger reads is its conversation's own folder (`request.json`, `context-use`) and the plugin's options, and the extension writes into whatever folder `ARTHUR_SESSION_FOLDER` names. A project agent's session from roadmap 88 can get its own folder through the same two extensions and a second `compactions` on that folder. The option names do not say "coordinator". Nothing for project agents is built.
- **Left alone:** jobs, orchestration, the core (including the fake agent), `handoff-extension.ts`, `restart.ts`, the request format, and the outcome lines.

## Not available directly
- none. OMP 18.3.0 gives `ctx.getContextUsage()` to extension event handlers (see Approach), so the owner has no decision to make before code. No workaround or new dependency is needed.

## Files
- `packages/session/src/session-options.ts`: add `compactOn: "schedule"` and `compactAtPercent: 80` to `DEFAULTS`. Add two `table` entries with one-line `about` texts (which trigger is used; the threshold, used only with `"context"`/`"both"`), the defaults `'"schedule"'` and `"80"`, and the two checks.
- `packages/session/src/session.ts`:
  - `SessionOptions` gets `compactOn?: "schedule" | "context" | "both"` and `compactAtPercent?: number`.
  - `start()` also removes `context-use`.
  - `compactions()` gets: an empty `compactAt` when `"context"`; the read-and-remove of `context-use`; the `armed` flag and the request with slot `context <n>%`; re-arming when a compaction's outcome line starts `compact: done`.
  - Update the header and `compactions` comments.
- `packages/session/src/turn-extension.ts`: add an optional `getContextUsage?(): { readonly contextWindow?: number; readonly percent?: number } | undefined` to the `agent_end` ctx type. Write `context-use` at each real end of a coordinator turn, before the failure logic. Update the header comment. The file name is hard-coded, as `handoff-extension.ts` hard-codes `request.json`.
- `packages/session/src/request.ts`: comment only. `slot` may also be `context <n>%`.
- `packages/session/docs/session.md`:
  - Options table: rows for `compactOn` and `compactAtPercent`, and the new refusals in the "Refused at load" paragraph.
  - "Compaction during the day": the context trigger. When it asks, what re-arms it, and that "both" means whichever first and never two queued. Advice to set the percentage below OMP's own auto-compaction, which compacts near the limit without a handoff [INFERENCE: OMP's `compaction.enabled` defaults true with a reserve-based threshold; exact point not measured].
  - `context-use` added under Files.
- `arthur.config.example.ts`: `compactOn: "schedule"` and `compactAtPercent: 80`, each with a one-line comment, in the `session({...})` block (lines 214-223).
- `packages/session/test/session.test.ts`: the trigger, option and job-launch tests (How to test). Run the three existing compaction tests (done / failed write / busy) once per trigger: either moving the clock to the slot or writing `context-use`.
- `packages/session/test/start-notice.test.ts` (it already drives `turnFailures` directly, lines 142-146): the report tests for the extension.
- `test/structure.test.ts`: raise `session` in `BUDGETS` from 917 to the new count. The package is exactly at 917 today (measured with the 160-character rule), and this change adds roughly 30 lines. The raise is stated in the merge's outcome.md.

## Risks
- **Context compaction never fires** if a future OMP drops or renames `getContextUsage`: the optional call then gives no report. The docs name the API and OMP version it relies on. Smoke against the real OMP once (How to test).
- **A report lost to a race.** The extension renames a new `context-use` between `arthur run`'s read and its remove. At most one turn's report is lost; the next turn end reports again.
- **A false re-fire right after a compaction.** The old high report is consumed before the request is even written. After `compact: done` only a new turn end can ask again, and that turn measures the compacted conversation.
- **A skipped or failed context compaction does not re-fire** until a compaction is done or a turn ends below the threshold. With `"context"` alone, that can mean until the nightly fresh start. This is what Done means asks for literally; see Open questions.
- **Jobs.** Orchestration hands `coordinator.extension` only to the coordinator (`packages/orchestration/src/orchestration.ts:155`), and the extension returns early without `hasUI`. No job path changes. The job-launch test pins this.
- **Fixed waits.** `FIXED_WAITS` may not be raised (`session.test.ts`: 10). A "nothing happens" assertion waits until `context-use` is gone instead. The tick consumes it and makes the request and schedule decisions in the same synchronous call, so the file being gone means the decision was taken.
- **Existing tests.** The default-defaults test (`valueDefaults(table) === DEFAULTS`) needs both new defaults in `DEFAULTS`. The unknown-option message lists all options, so the expected text in the options test gets the two new names. The baseline was green: `node --test packages/session/test/session.test.ts packages/session/test/start-notice.test.ts`, 19 pass.

## How to test
- **The option picks the trigger, schedule is the default, bad values are refused.** In `checkOptions`:
  - `{}` and each of `"schedule"`, `"context"`, `"both"` pass. `"hourly"`, `true` and `null` are refused naming `compactOn`.
  - `compactAtPercent` 1 and 99 pass. 0, 100, 50.5, `"80"` and -1 are refused naming `compactAtPercent`.
  - The unknown-option line lists both new options.
  - The defaults test covers `DEFAULTS`.
- **The default config compacts only on the schedule.** `load(t, {}, …)` at 07:59. Write `context-use` as `95` and wait until it is gone: no request. Move to 08:00: a request with slot `08:00`.
- **Context only.**
  - With `compactOn: "context", compactAtPercent: 80`: a report of `79.9` asks nothing. A report of `80` gives a request `{ then: "compact", slot: "context 80%", waitSeconds }`.
  - Passing a `compactAt` slot, then writing a low report and waiting for it to be consumed: no request.
  - At the limits: `compactAtPercent: 1` with `0.9` (no) and `1` (yes); `compactAtPercent: 99` with `98.99` (no) and `99` (yes).
- **Both, whichever comes first.** With `"both"`, a slot asks and a report at or above the threshold also asks. While one request is pending, the other trigger adds none: same `asked` after the next report is consumed.
- **A repeated crossing fires once.**
  1. Report `85`: a request.
  2. Report `90` while it is pending: the same request.
  3. Remove the request without an outcome (withdrawn), then report `91`: no new request.
  4. Write the request with line `compact: done; …`: the line is printed and the request removed. Then report `92`: a new request.
  5. Separately: a report below the threshold re-arms, so the next report above it asks.
- **Same compaction as a scheduled one.** The existing tests at session.test.ts:59-123 and the busy test run once per trigger, triggered by a slot or by writing `context-use`, with the fake agent and the handoff extension. Each shows: handoff first, then compaction, then read-back; a failed write gives `compact: skipped, handoff not written: …` and no compaction; a session busy past `compactWaitSeconds` gives `compact: skipped, session busy for <n> s`.
- **The turn extension's report** (start-notice.test.ts, called directly with a fake `pi`/`ctx`):
  - A UI turn's end with `getContextUsage` → `{ contextWindow: 200000, percent: 83.5 }` leaves `context-use` = `83.5`.
  - No file when: `hasUI: false`, `willContinue: true`, `contextWindow: 0`, `getContextUsage` absent, or it returns `undefined`.
  - A failed turn still leaves both its `turn-failed/` file and the report.
- **Jobs untouched.** On a fake host rooted in a temporary Git repository, with `fakeAgent` on `PATH`, spawn a worker under `compactOn` `"schedule"`, `"context"` and `"both"`. The `args`/`cwd` in `starts.jsonl`, with the job id and home replaced by placeholders, are equal across triggers, and none names `turn-extension.ts` or `handoff-extension.ts`.
- **Smoke against real OMP** (getContextUsage is only proven from the binary's strings). In a throwaway tmux session with its own socket name, start `omp --no-session -e packages/session/src/turn-extension.ts` with `ARTHUR_SESSION_FOLDER` set to a temporary folder. Send one short prompt and check that `context-use` holds a number between 0 and 100. Remove the session and folder afterwards.
- **Docs and example.** `packages/session/docs/session.md` and `arthur.config.example.ts` show both options. `npm run check` and `npm test` (one call, timeout 1800) pass, including `test/structure.test.ts` with the raised `session` budget.

## Open questions
- When a context-triggered compaction is skipped (busy past `compactWaitSeconds`) or withdrawn (handoff not written), should the next turn end at or above the threshold ask again? The plan follows Done means literally: no new request until a compaction is done or a turn ends below the threshold. With `"context"` alone, that can mean until the nightly fresh start.
- With `"both"`, should a context-triggered compaction cancel the next scheduled slot? The plan keeps the two independent, so a slot shortly after a context compaction compacts again.
- Default `compactAtPercent`: the plan uses 80, the value OMP's own threshold setting labels "Typical threshold". The ticket names none.