# AR0665 - Review 2

- Job: 2026-11-10-review-ad549ef0
- Branch: arthur/2026-11-10-worker-1ca8d870
- Commit reviewed: a5357c4c4599cd4156e972f250cd6c6c31ba1b82
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0665 asks:

- `arthur ticket status <id> planned` without `--autopilot` needs `--decision`. The core asks `decision.owner` by name, `kind: "plan"`, for that ticket.
- `arthur merge <job>` after a PASS needs a `merge` decision of its ticket; `--auto` asks for none.
- `plans.ts` counts an approval line only when its `(AR-Dn)` is a `plan` decision of the ticket in the log. The owner's own message must hold the later answer, and that answer must approve the same commit.

Every route into `planned` is gated. The board only allows `planning → planned`, and the only other code that moves a ticket to `planned` is autopilot's policy move (`orchestration/src/autopilot.ts:78`). Status names are matched exactly (`board.ts` `STATUSES.includes`). A provider that answers anything but `""` refuses the move, and so does a missing provider. Policy answers (`byPolicy`) and grant answers (`byRecommendation`) carry no `message`, so `plans.ts:85` also refuses them. Delivery's wakes and refusals, `merge.md`, `ticket.md`, `decision.md`, `plan.md`, `silent.md`, the coordinator role, `plan-ended.md`, `docs/plugin-api.md` and the evals all name `--decision`. A search for `on his word`, a bare `arthur merge <job>` and `ticket status … planned` without `--decision` found nothing stale. The core +18 and orchestration +17 budget raises rest on AR-D538 (measured raises allowed, answered in `spec/decisions.jsonl:1109`). `merge-command.ts` stays at 220 counted lines, the same yellow as on main.

## Notes
- (risk) packages/orchestration/src/decision-writes.ts:37: the new gates rest on weaker proof than merge flags. `impact()` returns undefined for a `plan` decision and for a plain merge decision of a ticket (no `--what`). Such an answer is recorded from any owner message that holds the words, without naming the id. So a bare "yes" sent after the ask is enough to set a ticket `planned` or merge a branch. The message proof itself is AR0664's (Scope Out); F4 covers only what the answer says, not this.
- (minor) packages/orchestration/src/plans.ts:67: when the spawn's project is not in `host.board.projects()`, the `- Plan: yes` check is now skipped. Before, it ran with an empty path. The core resolves the project before `beforeSpawn` runs, so this looks unreachable [INFERENCE].

## Checks (on a5357c4c, clean tree)
- `npm run check && npm test`: tsc reported no errors; 1688 tests, 1624 pass, 0 fail, 64 skipped (461 s).
- `npm run mutate`: `25 mutants, 25 caught, 0 survived; 157 not run (--max 25)`.
- I mutated by hand and ran the package's tests on each mutation, then restored the file with `git checkout --`. `git status --short` was empty at the end. Every mutation failed at least one test:
  - **`ticket-command.ts`:** asking never on a move to planned (`to === "planned"` → `false`): `ticket-command.test.ts` fail 1.
  - **`ticket-command.ts`:** dropping the refusal of `--decision` with a status other than planned: fail 1.
  - **`ticket-command.ts`:** asking `kind: "merge"` instead of `"plan"`: `ticket-command.test.ts` + `cli.test.ts` fail 2.
  - **`decision-use.ts`:** a repeated `planned` use refused (`/^(merge|planned) /` → `/^merge /`): `decision-use.test.ts` fail 1.
  - **`decision-use.ts`:** `--what` checked for a plain merge too (`what.startsWith("--")` removed): fail 1.
  - **`plans.ts`:** removing in turn the kind check, the ticket check, the `message` check, the commit check (`DECIDED`) and `if (!proved)`; and taking the first answer instead of the later one (`answers.at(-1)` → `.at(0)`): `plans.test.ts` fail 1 each.
  - **`merge-command.ts`:** a plain merge asking for nothing; `--auto` asking too; a flagged merge asking for nothing; `--auto --decision` accepted: `merge-command.test.ts` fail 1 each.
  - One batch of merge-command mutations first ran in parallel calls that edited the same file at once, so those results were unreliable. I discarded them and ran the mutations again one at a time; the results above are the reruns.
- `npx arthur ticket --help`: prints the `planned --decision` usage (2 lines match). I could not run `npx arthur merge --help` in this checkout: there is no `arthur.config.ts`, so the plugin commands do not load (`unknown command merge`).

PASS