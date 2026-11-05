# AR0399 - Outcome

- Merged: 2026-11-05, `a186c156`
- Branch: arthur/2026-11-05-worker-c3195e81
- Reviews: review-1.md PASS
- Cost: worker $2.55, reviews $0.30; review rounds 1

## What went in

- packages/github/src/github-git.ts: `push` runs `git push --dry-run` before `git lfs push origin <ref>` on a `filter=lfs` branch, so a transport Git refuses gets no LFS upload, and answers with the dry run's `<why>`.
- packages/github/test/github.test.ts: new test. The LFS step runs nothing for a folder, `file://`, `evil::`, `evil://`, `ext::` or an `evil://` pushurl, and does run (upload, then hook) once the owner allows folders.
- packages/github/docs/github.md: the push paragraph says git-lfs reads no `protocol.<name>.allow`, so the upload runs only after a passing `git push --dry-run`.
- docs/deploy.md: the threat model says the LFS upload before a push runs only once a dry run of that push passes.
- spec/features/AR0399-git-lfs-push-origin-reads-origin-s-url-outside-git-s-transport-policy/findings.md: new; F1, a committed `.lfsconfig` sends the LFS upload to another server, past the dry run (open).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1485/1556 passed.

## Left open

- Deferred (client summary): F1. A committed .lfsconfig sends github.push's LFS upload to another endpoint, past the dry run
- Deferred (client summary): F2. there is a gap between the dry run and the upload
