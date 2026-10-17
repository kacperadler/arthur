# AR0103 - The README tells a newcomer what Arthur is, what works today, and how to try it

```json
{
  "id": "AR0103",
  "title": "The README tells a newcomer what Arthur is, what works today, and how to try it",
  "date": "2026-10-17"
}
```

## Description

The owner asked (2026-10-17, Telegram), after the diagram went into the README (AR0101), for the README to be brought up to date. Its status paragraph is one long sentence listing what runs, written when much less existed, and it predates the orchestration plugin (AR0094, AR0080), the projects plugin (AR0087) and the guards for other projects (AR0059, AR0092).

## Goal

A visitor to github.com/kacperadler/arthur understands in under a minute what Arthur is, for whom, what works today and what does not, and where to read more; the diagram (AR0101) stays as the picture of it.

- Kind: improvement

## Done means

- `README.md` opens with one short paragraph on what Arthur is (one human directing coding agents through one coordinator; each job in its own Git worktree; a small core plus plugins from one TypeScript config; nothing exposed to the internet), taken from `spec/vision.md`, not invented.
- A "Status" section with a short list of what works today and what is next, each item checked against `packages/` and `spec/build.json` on main (as AR0101 did), dated; "not usable yet" stays if it is still true.
- The links (vision, diagrams, example config, deploy and threat model, licence) kept and current; the commands that exist today shown with one line each, from their doc pages.
- The diagram section from AR0101 and its test unchanged.
- Nothing names a client or another of the owner's projects (Arthur's standing rule).
- `npm test` and `npm run check` pass.

## Scope

In:
- `README.md`.

Out:
- The GitHub repository description and topics: the coordinator proposes them to the owner, who sets them (no token here can).

## Decisions

- 2026-10-17: The owner asked for it while Arthur's build is paused; documentation, not build work, so it runs now.
- 2026-10-17: The owner: the README says what Arthur is and what it is not (from the vision), and lists its features, each marked built, in progress (partly built) or planned, checked against main as AR0101 did.
