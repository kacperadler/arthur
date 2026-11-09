# AR0664 - Review 2

- Job: 2026-11-09-review-1e00a9ff
- Branch: arthur/2026-11-09-worker-886b0650
- Commit reviewed: c5bef1b996f7ca60bd104506b2518e582ac14b13
- Verdict: PASS

## Final message

No finding blocks the merge. The branch meets every point the ticket's Done means names.

- **Message proof:** `arthur decision answer` records an answer only when one of the owner's own channel messages holds the words. That message must be in `inbox/turn/`, or in `inbox/answered/` and arrive at least a second after the ask. A message with no channel, an empty channel, or a `[forwarded from ` mark never counts. Case and spacing are ignored, and the words can't start or end inside a word. The refusal says to quote his words exactly. This is in `decision-proof.ts` and `decision-writes.ts:56-59`.
- **Record and use:** the answer record keeps `message`, and `arthur decisions <id>` shows it as `(message <n>)`. `decision.owner` refuses a latest answer without `message` (`decision-use.ts:46`). The log check refuses a `message` that is not a whole number.
- **High-impact answers:** a merge flag, any budget question, take-main (merge of no ticket and no job) and `--picked 1` on a class proposal need the id in his message. Each sends a notice built without the model, and silent mode does not hold it.
- **Silent grant:** the shell `--recommend` refuses in every form. Only the phone's `/silent on … --recommend` gives the grant.
- **Docs:** `decision.md`, `silent.md`, the coordinator role, `plan-ended.md`, `take-main.md` and `usage.md` are updated. I searched for the old shell-grant wording and for `decision answer` across packages, docs and roles, and no stale line is left.
- **Budget and file sizes:** the orchestration budget goes from 2764 to 2829, under AR-D538. That decision exists in `spec/decisions.jsonl:1109`: any package budget may be raised by what its ticket needs. No changed source file is yellow or red; the structure test prints none from orchestration.
- **Scope:** the files outside Scope In are `decision-views.ts`, needed to show `message`, and the docs that had to change with it. The worker's final message lists them all.

## Notes
- (security) packages/orchestration/src/decision-proof.ts:9-10: **the proof checks that his words are there, not what they mean.** I ran a throwaway script on a turn message "AR-D12 no, do not merge" with the id required. `proof()` accepted the words `AR-D12`, `no`, `do` and `AR-D12 no`, each as message 5. So a steered coordinator can record any `--decided` for a high-impact question by quoting just the id. The plan's design allows this, and the notice is the only mitigation. The worker raised it; findings.md does not exist, so it is not filed yet.
- (risk) packages/orchestration/src/decision-proof.ts:29: **text the owner did not write can count as his words.** The inbox text includes the file line `[<kind>, <mime>] (<path>)`, a path that holds the file's name, and the listen and video plugins' transcripts. A file or recording someone else made, which he re-uploads without forwarding, can then supply "his" words. The worker raised it; findings.md does not exist, so it is not filed yet.
- (risk) packages/orchestration/src/decision-classes.ts:60: **old class approvals still hold.** A class approved before AR0664, whose answer has no `message`, stays approved and keeps answering by policy. Only `decision.owner` checks the proof, and the ticket does not ask for more.
- (minor) packages/orchestration/src/silent.ts:150-152: **`/silent on` now reads its flags.** A work text holding `--until`, `--usage` or `--tickets` without `--recommend` now gets the usage back instead of being taken as the work. `silent.md` documents this.

## Checks (all on c5bef1b9)
- **`npm run check`:** tsc printed no errors.
- **`npm test`:** 1675 tests, 1611 pass, 0 fail, 64 skipped.
- **`npm run mutate`:** 25 mutants, 25 caught, 0 survived; 131 not run.
- **Hand mutations:** each one made a test fail, and I restored each file with `git checkout --`; `git status --short` was clean at the end.
  - `decision-use.test.ts`, 1 fail: the `message === undefined` refusal disabled.
  - `silent.test.ts`, 1 fail each:
    - `"decision"` removed from the notices silent mode lets through;
    - the shell `--recommend` refusal disabled.
  - `decisions.test.ts`, 1 fail each:
    - the take-main impact test cut to `ticket === undefined`;
    - the forward check removed;
    - the lookbehind word check removed;
    - `asked + 1000` changed to `asked`;
    - the channel check removed.
- **`node --test test/structure.test.ts`:** 20 pass, 0 fail; no orchestration file is yellow or red.
- **`npx arthur silent --help`:** not checked; the checkout has no `arthur.config.ts`, so only the core's commands load. The real-CLI test in `decisions.test.ts` runs the answer refusal and pass end to end.

PASS