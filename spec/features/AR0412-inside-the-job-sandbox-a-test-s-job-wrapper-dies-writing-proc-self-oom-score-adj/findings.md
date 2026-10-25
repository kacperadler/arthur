# AR0412 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. EPERM in `oomFirst` is untested

- Kind: test
- Found by: 2026-10-25-review-582c13e7, 2026-10-25-review-d1e80c76 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/job-memory.ts:58`
- What: Dropping EPERM from the swallowed codes still passes; only EACCES is tested.
- Status: dropped (nothing here produces EPERM: Landlock, the sandbox's seccomp and the kernel all refuse with EACCES; a test would need root)

## F2. The refused-write test fails as root outside a sandbox

- Kind: test
- Found by: 2026-10-25-review-d1e80c76 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/test/scope.test.ts:328-329`
- What: Outside a job the refusal is a `chmod 0o444` file, which root writes anyway, so the test fails on its own precondition.
- Status: dropped (Arthur and its tests run as a non-root user, docs/setup.md step 1; CI runs as a non-root runner user)

## F3. `oomFirst` takes a `file` parameter for its test

- Kind: refactor
- Found by: 2026-10-25-review-d1e80c76 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/job-memory.ts:57`
- What: The default is the real file; only the test passes another.
- Status: dropped (the ticket's Done means allows a path made unwritable)
