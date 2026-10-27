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

- 2026-10-27: Source: F1 of AR0429
