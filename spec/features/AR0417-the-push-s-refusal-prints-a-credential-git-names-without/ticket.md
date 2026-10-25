# AR0417 - The push's refusal prints a credential git names without `://`

```json
{
  "id": "AR0417",
  "title": "The push's refusal prints a credential git names without `://`",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0342 (spec/features/AR0342-a-project-s-repo-url-is-printed-by-the-clone-s-refusals-with-any-credential-it-holds/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-3de620ca (worker), 2026-10-25
- Where: `packages/github/src/github-git.ts:49`
- What: the push replaces quoted words and `\S+://\S+` in git's line, but git 2.43 does not always print a URL: for a `git://` origin with userinfo it says `fatal: unable to look up arthur:s3cret@127.0.0.1:1 (port 9418) (Name or service not known)` (seen with `git clone --quiet -- git://arthur:s3cret@127.0.0.1:1/acme/shop.git <folder>`), with neither quotes nor `://`, so the credential would reach the push's refusal. The clone's refusal (AR0342) replaces every word holding an `@` instead.
- Suggestion: add `\S*@\S+` to the push's replacement, with a test pushing to such an origin; nothing else changes.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0342
