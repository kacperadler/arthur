# AR0717 - Review 1

- Job: 2026-11-23-review-6920a53b
- Branch: arthur/2026-11-23-worker-10684f84
- Commit reviewed: 2815dcb6f433e93f8de862f76bd62e675e3acaa7
- Verdict: FAIL

## Final message

The branch does not merge as it is. The two vision lines it was asked to change are right. The roadmap still has the same "once the other projects have moved to Arthur" sentence the branch took out of the vision, and the roadmap is not in the Scope's Out list.

**Findings**

1. **`spec/roadmap.md:13`, Order paragraph: it still says what the branch removed from the vision.** It reads: "The later entries follow the order the plan of AR0098 recommends: project agents (85 to 88) first, once the other projects have moved to Arthur, since only then is there more than one project to split…". The diff changed the vision's twin of this sentence ("Project agents (roadmap 85 to 88) come before all of them, once the other projects have moved to Arthur") to "came before all of them and are built". Searching for the removed text, as the review criteria ask, finds this line.
   - The Scope's Out names only "The rest of the vision", so the criteria count this as a FAIL ("a line of … the roadmap … still says what the branch changed … in a file the Scope's Out does not name").
   - Fixing the roadmap sentence is not a product call. The future condition just needs to go and the sentence move to the past tense, e.g. "project agents (85 to 88) came first and are built (AR0705 to AR0708)".
   - The worker saw this and logged it as F1 instead of fixing it. That records the gap but does not close it.

2. **`docs/architecture/versions.mmd:15-16,30` and `docs/architecture/core-and-plugins.mmd:105`: the same F1 lines, and the contradiction is new.** Before the branch, the vision's orchestration row said "Later, an agent per project…", which matched both diagrams putting `agents` in the grey dashed `later` class. After it, `spec/vision.md:66` puts project agents in a row marked "first, always on" and drops "Later,". `spec/vision.md:97` still counts them in the order of the later plugins.
   - So the vision now disagrees with itself about which version project agents belong to. The diagrams agree with line 97 and not with line 66.
   - The worker's reading holds as far as it goes: the diagrams chart versions, and `v0.1.0` was tagged before AR0705 merged. But the edited row 66 no longer says that.
   - Either row 66 keeps the "later version" meaning (e.g. "Later, built: an agent per project…"), or the diagrams mark `agents` as built, as `arthur.mmd:157` does. Which one is the owner's choice, and F1 already lays out both options.

## Notes
- (minor) `spec/vision.md:66`: "…, and the routing of that chat to it, built (roadmap 85 to 88)." The trailing "built" reads like it describes only the routing, not the agents and the routing.
- (minor) `spec/vision.md:66,97`: the worker chose the exact wording in the owner's document. AR-D707 approved the substance, so the owner should confirm the words at merge, as the worker asked.

**Checks** (all on 2815dcb6, clean tree)
- `npm run check`: `tsc` printed nothing, passed.
- `npm test`: tests 1916, pass 1852, fail 0, skipped 64. My first combined `npm run check && npm test` call exited 1 only because my `grep` filter matched no summary lines, so I ran `npm test` again on its own to get the counts above.
- `npm run mutate`: `mutate: 0 mutants, 0 caught, 0 survived`. The diff is docs only, so there is nothing to mutate.
- Diff against the ticket from `git show cca4f1ae…:…/ticket.md`: only lines 66 and 97 of `spec/vision.md` changed, plus the new `findings.md`. Both Done means points hold for the vision itself.
- Grep for the removed and changed phrases in the roadmap, docs, diagrams, README, roles and package docs: the only stale hits are `spec/roadmap.md:13`, `versions.mmd:16,30` and `core-and-plugins.mmd:105`.
- No real client or other-project name in the diff, and no instruction-like text in the data I read.

FAIL