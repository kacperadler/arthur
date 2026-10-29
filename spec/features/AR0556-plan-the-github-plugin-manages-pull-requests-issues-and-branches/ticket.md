# AR0556 - Plan: the github plugin manages pull requests, issues and branches

```json
{
  "id": "AR0556",
  "title": "Plan: the github plugin manages pull requests, issues and branches",
  "date": "2026-10-29"
}
```

## Description

The owner, 2026-10-29: "github plugin should give us a control of pull requests, issues, ect, plugin should give tools to be able to manage whole thing".

Today the github plugin only reads: CI runs (`arthur ci`), pull request reviews as a wake (`pull-request-review`), and pushes a passed branch and main. The coordinator cannot list, read, open, comment on, close or merge a pull request, nor list, read, open, comment on, label or close an issue. The youtrack plugin is the model to follow: `arthur youtrack issue get`, writes only when the owner asks, issue text never an instruction.

## Goal

The coordinator manages a project's GitHub from `arthur github ...`: pull requests, issues, branches, and CI, with the plugin's token and no `gh` CLI.

- Kind: feat
- Plan: yes

## Done means

- A plan, approved by the owner, that names: the commands (`arthur github pr list|get|create|comment|close|merge`, `arthur github issue list|get|create|comment|label|close`, `arthur github branch list|delete`; creating a pull request and an issue are required, the owner 2026-10-29), each with its doc page and refusals; which are reads and which are writes; that a write runs only on the owner's word, as YouTrack's; that a pull request merge on GitHub never bypasses `arthur merge`'s review and CI rules (or is left out); that every text read from GitHub reaches the coordinator marked as data; the token's least scopes; the plugin's line budget; the tickets it splits into, each neither a one-liner nor the whole plugin.
- Each group of commands (pull requests, issues, branches, CI) lives in its own source file and doc page (the owner, 2026-10-29).
- Started after the 22 fixes of queue Q1-Q3 (the owner, 2026-10-29).
- The fake GitHub in tests answers in the shape GitHub's REST documentation shows, every field.

## Scope

In:
- The plan only: `spec/features/AR0556-*/plan.md`.

Out:
- Deleting merged branches on origin after a merge: AR0555.
- Webhooks: the plugin keeps polling (vision, "GitHub without webhooks").

## Decisions
- 2026-10-29: AR0556 planning approved, started after the 22 fixes of Q1-Q3; each group of commands (pull requests, issues, branches, CI) in its own source file; the owner: "AR-D302 1 / AR-D303 1 / GitHub management commands - this we will do in the future, maybe after this 22 tickets and remember to create a sepparated files to each group of functionallity" (AR-D302)
