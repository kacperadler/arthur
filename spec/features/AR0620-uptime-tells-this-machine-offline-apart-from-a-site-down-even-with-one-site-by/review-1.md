# AR0620 - Review 1

- Job: 2026-11-04-review-4cdcae56
- Branch: arthur/2026-11-04-worker-bc992ba7
- Commit reviewed: eab6b590bfff5691493e258b49f8acdde199f4f6
- Verdict: FAIL

## Final message

**Verdict: FAIL.** The probe refusal that "Done means" asks for has two uncaught gaps.

1. **`packages/uptime/src/uptime-options.ts:26`: two surviving mutants move the probe refusal's limit by one.** `npm run mutate` reports:
   - `["0.0.0.0", 8]` changed to `["0.0.0.0", 9]` survived.
   - `["127.0.0.0", 8]` changed to `["127.0.0.0", 9]` survived.

   Each change lets half of that range through as a probe, for example `127.200.0.1` or `0.200.0.1`. Every address the new test uses (`127.0.0.1`, `127.8.0.1`, `0.0.0.0`) falls inside the /9, so the tests cannot catch it. The line was moved from `site-check.ts`, but it now holds a new behavior the ticket names ("a private, loopback or link-local address refused at load"). The review criteria count an uncaught "limit moved by one" on a key behavior as a FAIL. Fix: add `127.255.255.254` and `0.255.255.255` to the `hosts` list in `uptime-options.test.ts`.

2. **`packages/uptime/src/uptime-options.ts:31`: `https://localhost./` gets past the refusal.** `new URL(...).hostname` keeps the trailing dot, and `/(^|\.)localhost$/i` does not match `localhost.`. I ran `checkOptions({ probes: ["https://localhost./"] })` and it returns `[]`, so this loopback name is accepted at load. A loopback probe always answers, so the machine would never be called offline. Other forms tried (`LOCALHOST`, `127.1`, `[::ffff:7f00:1]`, `127.200.0.1`) are refused.

## Notes
- (risk) `packages/uptime/src/uptime-options.ts:31`: a name that resolves to loopback is not refused. Any DNS name that points at 127.0.0.1 passes the load check, and `probe` uses a plain `fetch` without the `guarded` lookup that sites use, so the probe answers locally and offline is never detected. NAT64 `[64:ff9b::7f00:1]` is also accepted. That last one matches the existing `PRIVATE` list, which `site-check` also uses.
- (minor) `packages/uptime/src/site-check.ts:49`: the probe's 10 s cut is untested. The mutants `* 1001` and `* 999` survived; removing the cut entirely would let a hanging probe stall every check.
- (minor) `arthur.config.example.ts:275,278`: the two survivors there revert the `probes` comment and delete the example `uptime({ probes })` line. Both are config-example text, not behavior; no finding.
- (minor) `packages/uptime/src/uptime.ts:80`: the offline notice still says "one notice follows when a site answers again", although a probe answering now also ends offline ("a probe answers again"). The worker's message mentions this.
- (minor) `packages/uptime/src/uptime-options.ts:54`: `table.probes.check` repeats the validation `checkOptions` already does per place. It is small, and the table entry needs some `check`.
- (minor) `test/structure.test.ts:52`: the uptime budget goes 312 → 343. Going through the added lines (the `probes` table entry and its per-place check, `PROBES`, `probe()`, the `telling` helper that replaces a repeated expression, the `reached` flow), each one serves the feature. Moving `PRIVATE` is line-neutral; the only extra is about one line of re-wrapped header comment. The raise looks justified and belongs in `outcome.md`.

## Checks (detached checkout at `eab6b590`)
- `npm run check && npm test`: tsc clean. The first run's output was filtered too narrowly to show the counts, so I ran `npm test` again: tests 1530, pass 1466, fail 0, skipped 64.
- `npm run mutate`: 25 mutants, 19 caught, 6 survived, 133 not run (it stops at 25 by default). The survivors are the two in `arthur.config.example.ts`, two on the `site-check.ts:49` timeout and two on the `uptime-options.ts:26` prefixes.
- A Node one-liner calling `checkOptions` with the forms above: only `https://localhost./` and `https://[64:ff9b::7f00:1]/` are accepted.
- I made no hand mutations; the worktree is unchanged.

FAIL