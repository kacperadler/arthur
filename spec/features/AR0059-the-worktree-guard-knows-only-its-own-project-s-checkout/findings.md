# AR0059 - Findings

## F1. A project added while a job runs is not guarded from that job

- Kind: risk
- Found by: 2026-10-17-ar0059-739ce1fb (worker), 2026-10-17
- Where: `packages/core/src/jobs.ts` (spawn writes `projects` into the record), `packages/core/src/worktree-guard.ts` (`jobPlace`)
- What: the list of other projects' checkouts is written into the job record at spawn; a project added to `arthur.config.ts` while the job runs is unknown to that job's guard until the job ends.
- Suggestion: the guard reads, on every call, one file under the home folder that the projects plugin rewrites whenever the config changes.
- Status: ticket AR0092

## F2. `git update-ref` in another repository is refused under the wrong name

- Kind: cleanup
- Found by: 2026-10-17-review-ar0059-704cfa9b (review), 2026-10-17
- Where: `packages/core/src/worktree-guard.ts` (the `update-ref` case)
- What: `git -C <other repo> update-ref refs/heads/x <sha>` is refused, but the refusal names the job's own main checkout, not the other project.
- Suggestion: none needed; the write is refused either way.
- Status: dropped (the write is still refused; only the label is wrong, and the guard is documented as not a sandbox)
