# AR0131 - Plan: mail and calendar plugins, and the way to the company edition

```json
{
  "id": "AR0131",
  "title": "Plan: mail and calendar plugins, and the way to the company edition",
  "date": "2026-10-18"
}
```

## Description

The owner asks for mail and calendar (Google, Apple, other mail providers) and whether they belong in the coding edition or the company edition (entry 79), and how Arthur gets from one to the other. The roadmap has neither a mail nor a calendar entry, and entry 79 is one line of weeks. This ticket writes the plan, for the owner to pick before any roadmap edit.

## Goal

The owner sees what mail and calendar would do for him, where they land, and the concrete path from the coding edition to the company edition.

- Kind: improvement
- Plan: tak

## Done means

- `plan.md` in this folder:
  - Uses, each with who benefits (the owner as a coder, a company role): mail in as a channel (a client's message becomes a ticket or a note), mail out (a reply, a report) behind approval; calendar read (the morning report names today's meetings, the coordinator does not plan work over them), calendar write (a meeting proposed) behind approval.
  - Providers and access: Google (Gmail and Calendar API, OAuth), Apple (iCloud CalDAV with an app password), Microsoft 365 / Outlook (Graph API), any mail by IMAP and SMTP, any calendar by CalDAV or an ICS link, and other common providers the plan finds (for example Proton Mail through its bridge, Fastmail, Zoho); each provider an instance of one plugin where the protocol is shared; secrets only in the environment, as the vision requires; read-only first; nothing exposed (polled).
  - Plugins: `mail` and `calendar` as two plugins with named instances, or one per provider; what each emits and offers other plugins; quiet hours and silent mode (AR0127).
  - Coding or company edition: which uses fit the coding edition now (calendar in the morning report, a client's mail becomes a ticket) and which wait for roles and approvals (79).
  - The owner's view to test first: the company edition is not a separate track but more plugins (business roles as standing agents, like a project agent per project, 85 to 88) added to the same Arthur; the plan says what, if anything, that view misses.
  - The way to the company edition: a set of plugins and standing agents on the same core (vision, "the company edition is plugins on the same core"), what has to exist first (project agents 85 to 88, panel 77, knowledge base 78, approvals, per-role data), and how 79 splits into entries.
  - Where each lands in the roadmap: entry numbers and dependencies.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- The roadmap and vision edits: a follow-up ticket after the owner picks.

## Decisions

- 2026-10-18: The owner asked about mail and calendar plugins and how Arthur reaches the company edition; the coordinator proposes a plan first.
- 2026-10-18: The owner approved it as a plan only. He sees the company edition as more plugins on the same Arthur, since standing agents (one per project) already come; mail and calendar must plan for other providers too, not only Google and Apple.
- 2026-10-19: The owner: this plan stays at planning until the roadmap reaches it; nothing is built before.
