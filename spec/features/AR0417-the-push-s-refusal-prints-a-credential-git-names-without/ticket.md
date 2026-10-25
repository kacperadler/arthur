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

A push's refusal never prints a credential from origin's URL, whatever form git prints it in; tested. Evidence: `packages/github/src/github-git.ts:49` replaces only quoted words and `\S+://\S+`; git 2.43 prints `fatal: unable to look up arthur:s3cret@127.0.0.1:1 (port 9418) …` for a `git://` URL with userinfo (seen in AR0342).

- Kind: security

## Done means

- `github-git.ts:49` also replaces every word holding an `@` (`\S*@\S+`) with `origin`, as the clone's refusal does (AR0342). Test in `packages/github/test/github.test.ts`, beside the push refusals at `:490-495`: a project whose origin is `git://arthur:s3cret@127.0.0.1:1/acme/shop.git` (offline: no lookup leaves the machine); the push's line never holds `s3cret`. It fails without the change.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/github/src/github-git.ts`: the `@` replacement in the push's `why`.
- `packages/github/test/github.test.ts`: the test above.

Out:
- The clone's refusal: AR0342 (merged), AR0418.

## Decisions

- 2026-10-25: Source: F1 of AR0342
- 2026-10-25: AR0417 approved as written; the owner: "Approved" (AR-D15)
