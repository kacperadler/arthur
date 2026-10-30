# Findings of AR0573

## F1. The eval stubs print a spec commit that the stub never makes

- Kind: test
- Found by: review 1 (not blocking)
- What: `delivery/evals/{merge,review-pass}` and `session/evals/*` print `committed spec: ... merged: <hash>`, but `eval-stub.ts` only writes files; in `review-pass`, `refs/heads/main: moved` is now met by the coordinator's own commit when it files the review.
- Status: deferred (client summary)

## F2. A git-ignored path in the merge's commit list makes git add fail

- Kind: fix
- Found by: review 1 (not blocking)
- What: for example a project that ignores `CHANGELOG.md`; it ends in the safe `not committed` line.
- Status: deferred (client summary)
