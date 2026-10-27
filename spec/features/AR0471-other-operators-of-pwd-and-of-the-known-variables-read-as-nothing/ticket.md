# AR0471 - Other operators of `${PWD…}` and of the known variables read as nothing

```json
{
  "id": "AR0471",
  "title": "Other operators of `${PWD…}` and of the known variables read as nothing",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0429 (spec/features/AR0429-the-guard-misreads-four-short-forms-arthur-job-env-c-and-sudo-d-a-after-cd-pwd/findings.md).

- Kind: security
- Found by: 2026-10-27-review-7254140b (review), 2026-10-27
- Where: `packages/core/src/shell-words.ts:93`
- What: `${PWD%/x}`, `${ARTHUR_JOB%/*}`, `${HOME#/}` and the other operators but `-`, `=`, `?`, `+` give nothing, so `echo x > ${ARTHUR_JOB%/*}/<other job>/result` is judged as `/<other job>/result` and passes, while bash writes into the jobs' folder. An unquoted heredoc's `$PWD` is read only in its plain forms (`$PWD`, `${PWD}`), not with an operator. The ticket's Scope puts other operators out.
- Suggestion: refuse a `${…}` of a known variable or of `PWD` with an operator the parser does not read, as `OLDPWD_UNKNOWN` does for `${OLDPWD…}`; leave computing the operators out.

## Goal

A job can write into another job's folder through `${ARTHUR_JOB%/*}` and the other `${…}` operators the guard reads as nothing (evidence in the finding above).

- Kind: security

## Done means

- A `${…}` of `PWD` or a known variable with an operator the parser does not read is refused, as `${OLDPWD…}` is; rows in `packages/core/test/worktree-guard.test.ts` that fail without the fix.

## Scope

In:
- `packages/core/src/shell-words.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- Computing the operators; AR0472 and AR0473.

## Decisions

- 2026-10-27: Source: F1 of AR0429
- 2026-10-27: AR0471 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D126)
- 2026-10-27: AR0471: a third round; the worker reads the fallback word as bash does (no redirects or comments inside it) with the known variables; the owner: "keep going till 88% of Claude 7 Day limit, go silent and always go with recommendations" (AR-D150)
- 2026-10-27: AR0471: round 4 with refusal instead of emulation: a fallback word with unquoted space, tab, newline or any of < > ; & | ( ) # is refused as unknown; no word splitting; the owner: "keep going till 88% of Claude 7 Day limit, go silent and always go with recommendations" (AR-D157)
- 2026-10-27: AR0471: round 5, a ~ inside a double-quoted fallback stays text (no HOME expansion), with test rows; if round 5 fails, drop the branch and refile; the owner: "keep going till 88% of Claude 7 Day limit, go silent and always go with recommendations" (AR-D161)
