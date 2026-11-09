# AR0659 - The README's Status paragraph stops copying the roadmap's state

```json
{
  "id": "AR0659",
  "title": "The README's Status paragraph stops copying the roadmap's state",
  "date": "2026-11-06"
}
```

## Description

The README's Status paragraph keeps only what does not change from ticket to ticket, so it can no longer fall behind main; the roadmap page stays the place that says what is built.

## Goal

the doc rule exists (AR0595 in the worker role, AR0596 in the review criteria) and this line still drifted. Removing the copy makes the drift impossible. `test/readme.test.ts` keeps holding: the paragraph still names `arthur config check` and links `docs/setup.md`.

Evidence:
- AR0603 review-1.md F1: `README.md:27` "Next … and dokploy's upload and deploy" was still there after the branch built them.
- AR0634: the README Status said "main on 2026-10-25", "with Telegram as its channel" and a stale "Next".
- Earlier tickets for this same paragraph: AR0117, AR0119, AR0133.
- Today it says "main on 2026-11-05", already a day behind main.
- AR0634 made the roadmap page compute what is built from the board, so the paragraph is now a second, hand-kept copy.

- Kind: chore

## Done means

- `README.md`'s Status paragraph names no date, no channel by name and no next roadmap entry.
- `test/readme.test.ts` still passes, the paragraph still names `arthur config check` and links `docs/setup.md`.
- `npm run check` and `npm test` pass.

## Scope

In:
`README.md`, the Status paragraph (line 27).

Before:
> **Status: in use on its own repository** (main on 2026-11-05). Arthur takes its own tickets: it runs on its owner's VPS as a systemd service, with Discord as its channel (Telegram still available), and each ticket goes from its worker through a review and CI to its merge. [`docs/setup.md`](docs/setup.md) sets one up, each step with the command that checks it, such as `arthur config check`. Other projects follow; the order of the rest is [`spec/roadmap.md`](spec/roadmap.md), and the state of each entry is the board, [`spec/build.json`](spec/build.json), shown on [the roadmap page](https://kacperadler.github.io/arthur/roadmap/). Next, to close the first version: Docker's job labels, cleanup and leftover sweep (roadmap entries 70 to 72); then an agent per project, with its own chat (85 to 88), then the other plugins in the roadmap's order.

After:
> **Status: in use on its own repository.** Arthur takes its own tickets: it runs on its owner's VPS as a systemd service, talks to him through a chat channel plugin, and each ticket goes from its worker through a review and CI to its merge. [`docs/setup.md`](docs/setup.md) sets one up, each step with the command that checks it, such as `arthur config check`. Other projects follow. What is built and what comes next is [the roadmap page](https://kacperadler.github.io/arthur/roadmap/), drawn from the order of [`spec/roadmap.md`](spec/roadmap.md) and the board, [`spec/build.json`](spec/build.json).

Out:
- Anything past the file this proposal names; a larger change is a new ticket.

## Decisions

- 2026-11-06: Source: retro spec/retro/2026-11-06.md
- 2026-11-09: Merge it, in the order of the night summary (AR0659 before AR0499); the owner: "Merge all 11 in order above." (AR-D566)
