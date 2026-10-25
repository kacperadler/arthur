# AR0418 - A repo URL that new URL cannot parse is printed with its credential by the clone's refusal

```json
{
  "id": "AR0418",
  "title": "A repo URL that new URL cannot parse is printed with its credential by the clone's refusal",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0342 (spec/features/AR0342-a-project-s-repo-url-is-printed-by-the-clone-s-refusals-with-any-credential-it-holds/findings.md).

`shown` in `packages/projects/src/clone.ts` strips userinfo only when `new URL(repo)` parses. A `repo` it cannot parse, such as `https://u:s3cret@host:99999/x.git` (port out of range) or `https://u:s3cret@exa mple.com/x.git` (space in the host), goes into the `git clone <repo> failed` refusal with its credential (review 2026-10-25-review-80f82f57, probed with `node -e`).

## Goal

A clone refusal never prints a credential from `repo`, parsed or not; tested.

- Kind: security

## Done means

- In `shown`, a URL that does not parse has only its userinfo after `//` removed; `git@host:path`, which holds no secret, is printed as it is (coordinator, 2026-10-25: the first wording turned it into `the repo`). Test in `packages/projects/test/projects.test.ts`: a `repo` of `https://u:s3cret@host:99999/x.git` that fails to clone; the refusal shows its host and path and never holds `s3cret`; a `git@host:path` refusal names it. The test fails without the change.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/projects/src/clone.ts`: `shown` masks an unparsable URL.
- `packages/projects/test/projects.test.ts`: the test above.

Out:
- A token in a URL's query string (`?token=`): dropped in AR0342's F3.
- The push's refusal: AR0417.

## Decisions

- 2026-10-25: Source: F2 of AR0342
- 2026-10-25: AR0418 approved as written; the owner: "Approved" (AR-D16)
