# AR0607 - Runbook: what the coordinator checks and does, in order, when a project site is down

```json
{
  "id": "AR0607",
  "title": "Runbook: what the coordinator checks and does, in order, when a project site is down",
  "date": "2026-11-02"
}
```

## Description

When the uptime plugin says a project's site is down, the coordinator gets a runbook: an ordered list of checks and steps, each with what to run and what its result means. It works through them (is this machine online, is the Dokploy server up, what the application and its last deployment say, then a redeploy when the checks point to one) and tells the owner what it found and did. A boilerplate runbook ships with Arthur; a project may hold its own.

## Goal

The owner asked, 2026-11-02, after kacperadler.pl got its uptime check (AR-D457): a file with instructions for a down site, with checks and todos in the right order, such as checking whether the server is available and working and, if so, trying a redeploy. Today `uptime-down` is only a notice to the owner (`packages/uptime/docs/uptime.md`, "Down and up"); nothing wakes the coordinator with steps, and `arthur dokploy` only reads (`app`, `status`): a deploy comes with AR0603.

- Plan: yes
- Kind: feat

## Done means

The plan decides each of these with the owner; the list is where it starts:

- A boilerplate runbook (Markdown, the steps in order: confirm the site is down from this machine, this machine online, the Dokploy server reachable, the application's status and its last deployment, the container's state if Dokploy's API gives it, then the action, then the report to the owner), and the place a project's own runbook lives, its path given in its project file.
- `uptime-down` wakes the coordinator with the project, the site, the reason and the runbook's path; `uptime-up` wakes it too, so the report says how it ended.
- Which steps the coordinator may take without asking (reads), and which need the owner's word (a redeploy, through AR0603's `arthur dokploy deploy`), or a decision class he approves for one project.
- Tests against the fake host and a fake Dokploy, the doc page, and the roadmap entry.

## Scope

In:
- The uptime plugin's wake, the boilerplate runbook, its doc; the plan names the files.

Out:
- The deploy itself: AR0603.
- Reacting to other signals (Sentry, server load): AR0216.

## Decisions
- 2026-11-02: AR0607 approved: a down-site runbook with checks and steps in order and a boilerplate; plan after the weekly reset (2026-11-04); the owner: "I think we have to add a file with instructions with steps what should be done when the site will be down, this file should have checks and todos with right order like check if serwer is…" (AR-D460, cut: arthur decisions AR-D460 prints it whole)
- 2026-11-04: Plan approved by the owner: plan.md at 53a57c48; the owner: "AR-D488 - 1" (AR-D488)

