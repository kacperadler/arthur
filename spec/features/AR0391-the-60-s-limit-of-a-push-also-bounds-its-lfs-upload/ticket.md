# AR0391 - The 60 s limit of a push also bounds its LFS upload

```json
{
  "id": "AR0391",
  "title": "The 60 s limit of a push also bounds its LFS upload",
  "date": "2026-10-25"
}
```

## Description

`github.push` kills `git lfs push origin <ref>` after 60 s, as it kills `git push`. A branch whose new large files take longer to upload is never pushed: each PASS, `no review` or merge starts the upload again and is killed again ([INFERENCE] that git-lfs resumes nothing across runs of a killed upload; not run).

## Goal

A large LFS upload gets a limit sized for it, so a branch with big files is pushed instead of being killed at 60 s each time.

- Kind: fix

## Done means

- The fix, with a test that proves it: a limit for the LFS upload that ends on no progress rather than on a fixed time, or a larger one for it alone; the `git push` limit stays.
- `npm test` and `npm run check` pass.

## Scope

In:
- a limit for the LFS upload that ends on no progress rather than on a fixed time, or a larger one for it alone; the `git push` limit stays.

## Decisions

- 2026-10-25: Source: F2 of AR0379
