# AR0038 - Roadmap: Later entries for the web panel, a knowledge base and a company edition

```json
{
  "id": "AR0038",
  "title": "Roadmap: Later entries for the web panel, a knowledge base and a company edition",
  "date": "2026-10-16"
}
```

## Description

The owner's ideas for the far future, recorded in `spec/roadmap.md` under Later so they are not lost: a web panel reached over Tailscale, a knowledge base, and, after the web panel, a company edition where Arthur coordinates business roles instead of code. Docs only; nothing is built.

## Goal

The roadmap holds the owner's long-term direction, and the first version keeps one door open for it: the core does not assume a project is a Git repository, nor that one human approves everything.

- Kind: improvement
- Model: haiku

## Done means

- `spec/roadmap.md`, Later, after entry 76, three new entries in the existing entry shape (Package, Delivers, Done means, Depends on, Size, Covers: none (new: the owner asked for it on 2026-10-16)):
  - 77. Web panel: the board, jobs, events and chat in a browser, served by `server` (75, 76) on the Tailscale network only; Tailscale identifies who connects, so the panel keeps no passwords. Depends on 76.
  - 78. Knowledge base: a project's or company's documents in three forms: plain documentation, search over them (RAG) that agents can query, and a chat that answers from them with sources. Depends on 77.
  - 79. Company edition: plugins for business roles (marketing, sales, research) run as standing agents that talk through the coordinator by tickets and notes, not freely to each other. Every action that leaves the company (an email, a post, an offer) waits for a human's approval. Roles, keys and data are per role: each Tailscale user gets roles, and a role's manager approves its decisions. Depends on 77 and 78.
- `spec/vision.md`, Directions or the plugin section, one line: the core never assumes a project is a Git repository or that a single human approves everything, so 79 is plugins on the same core.
- The sentence after entry 76 still says the later entries follow the other projects.
- `npm run check` and `npm test` pass. English only.

## Scope

In:
- `spec/roadmap.md`, `spec/vision.md`.

Out:
- Any code, any change to entries 1 to 76.

## Decisions

- 2026-10-16: The owner: code first, then the web panel; the company edition and the knowledge base only after the web panel, as a far future.
