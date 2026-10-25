# AR0396 - A `git fetch` or `git push` from a job's worktree into `refs/replace` still writes a replacement every worktree reads

```json
{
  "id": "AR0396",
  "title": "A `git fetch` or `git push` from a job's worktree into `refs/replace` still writes a replacement every worktree reads",
  "date": "2026-10-25"
}
```

## Description

with `git replace` refused, the same ref still arrives by a refspec. In a temporary repository with a job worktree `w` of main checkout `m`: `git -C w fetch . "HEAD:refs/replace/$(git -C m rev-parse main)"` made `git -C m replace -l` list main's tip and `git -C m status --short` show `M  f`; after `git -C m replace -d <tip>`, `git -C w push . "HEAD:refs/replace/<tip>"` wrote it again. A refspec in a remote's config (`git remote add --mirror=fetch`, `-c remote.<name>.fetch=…`, `git config --worktree remote.<name>.fetch …`) would do the same without naming `refs/replace` on the command line [INFERENCE: not run]. Arthur's own git calls with the hookless `-c` flags read past it (AR0384); the human's git commands in the main checkout, and the reads of F2, do not.

## Goal

A job's `git fetch` or `git push` cannot write into `refs/replace`, so no replacement reaches what every worktree reads.

- Kind: security

## Done means

- The fix, with a test that proves it: either set `core.useReplaceRefs=false` in each project's shared config (every worktree then reads past a replacement, whatever wrote it; it changes the user's repository config and turns off replacements the human may use, so it is the owner's call, and `git-config.ts`'s allowed set would need the key), or refuse in the guard a `fetch` or `push` whose words name a destination under `refs/replace` (an explicit `…:refs/replace/…`, a glob destination that covers it such as `refs/*`), naming the config-defined refspecs as a limit.
- `npm test` and `npm run check` pass.

## Scope

In:
- either set `core.useReplaceRefs=false` in each project's shared config (every worktree then reads past a replacement, whatever wrote it; it changes the user's repository config and turns off replacements the human may use, so it is the owner's call, and `git-config.ts`'s allowed set would need the key), or refuse in the guard a `fetch` or `push` whose words name a destination under `refs/replace` (an explicit `…:refs/replace/…`, a glob destination that covers it such as `refs/*`), naming the config-defined refspecs as a limit.

## Decisions

- 2026-10-25: Source: F1 of AR0384
