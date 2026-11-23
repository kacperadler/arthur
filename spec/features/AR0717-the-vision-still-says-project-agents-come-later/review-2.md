# AR0717 - Review 2

- Job: 2026-11-23-review-a56e9792
- Branch: arthur/2026-11-23-worker-10684f84
- Commit reviewed: 14d894d96440b36e421ddded9b18d3e6097b90c0
- Verdict: PASS

## Final message

## Findings

None. The branch does what AR0717 asks, and it applies the owner's AR-D712 decision.

- `spec/vision.md:66`: the orchestration row now reads "Later, built: an agent per project with a `chat`, and the routing of that chat to it (roadmap 85 to 88)". That is the wording AR-D712 asks for.
- `spec/vision.md:97`: "Project agents (roadmap 85 to 88) came before all of them and are built." The old condition "once the other projects have moved to Arthur" is gone. These are the only two lines of the vision the branch changes, which meets the "nothing else in `spec/vision.md`" point.
- `spec/roadmap.md:13`: the Order paragraph now says "project agents (85 to 88) came first and are built (AR0705 to AR0708)". This change is outside the ticket's Scope In, but AR-D712 covers it ("the roadmap keep[s] them as the first later item, marked built"), and the worker's message gives the reason (the previous review's finding 1). Entries 85 to 88 stay under `## Later`, as the decision says. `git grep "once the other projects\|only then is there more than one project"` outside `spec/features` and `spec/quality` finds nothing.
- `docs/architecture/versions.mmd:16,29-32` and `docs/architecture/core-and-plugins.mmd:38,104-107`: `agents` stays the first later item. Its label adds ", built", it moves out of the `later` class into a new `built` class, and each file's first-line comment explains the new style. The `classDef` and `class` lines use the same syntax as the lines already there. Together these meet "the diagrams … keep them as the first later item, marked built".
- `findings.md`: F1 is new, records the disagreement and the owner's choice, and is marked `fixed in 3cd38605`. It names no client and no other project.
- I checked other places that mention project agents: `README.md:32,34,71`, `arthur.config.example.ts`, `docs/plugin-api.md` and `CHANGELOG.md`. None of them calls project agents unbuilt or "later".
- What the worker's message claims matches what I saw: 4 commits, 5 files, 27 insertions and 9 deletions, and the check counts reproduce (below).

## Notes

- (minor) `docs/architecture/versions.mmd:29`, `docs/architecture/core-and-plugins.mmd:104`: no renderer is installed, so the new `built` class has not been drawn. The worker's message already says so.

## Checks (on 14d894d9)

- `npm run check && npm test`: `tsc` printed nothing. My first filter left out the summary lines, so I ran `npm test` again on its own: tests 1916, pass 1852, fail 0, cancelled 0, skipped 64, exit 0. It printed six yellow-zone lines, all for files this branch does not touch.
- `npm run mutate`: `mutate: 0 mutants, 0 caught, 0 survived`. The diff is docs only.
- `git diff --word-diff` on `spec/vision.md` shows changes only in lines 66 and 97. On `spec/roadmap.md` it shows only the project-agents clause of line 13.

PASS