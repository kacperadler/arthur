# AR0214 - Plan: role agents talk to each other, each with its own chat place

```json
{
  "id": "AR0214",
  "title": "Plan: role agents talk to each other, each with its own chat place",
  "date": "2026-10-19"
}
```

## Description

Roadmap entry 79 (company edition) says the business role agents, such as marketing and sales, talk through the coordinator by tickets and notes, not freely to each other. On 2026-10-19 the owner asked for the opposite.

The coordinator and every role agent can ask another role a question directly and get an answer, without the owner in between. For example, marketing asks sales for figures, or the coordinator asks marketing instead of doing the work itself.

Each agent is like one person. It has its own Discord server, which is its own chat place. Group servers also exist where several agents, for example marketing, sales and a programmer, talk among themselves to deliver one result. The owner can read along and speak in each place.

## Goal

A plan, written with the owner before anything is built, that settles the following and rewrites entries 79 and 85–87 to match:
- how agents address each other (a message, a question with an answer, a group thread);
- what an agent may ask of another;
- how a conversation is kept and shown to the owner;
- how loops and runaway costs are stopped;
- what still needs the owner's approval: everything that leaves the company, per entry 79;
- how one Discord server per agent and shared group servers map onto the `chat` places of entries 85–86 and Discord (89–90).

- Kind: feat
- Plan: tak

## Done means

- `spec/roadmap.md` has the rewritten entries, each with Done means and edge cases. The edge cases cover at least: an agent asking itself, two agents asking each other in a loop, an agent down when asked, a group place with an agent removed, and a question whose answer never comes.
- The owner has approved the plan.

## Decisions

- 2026-10-19: The owner wants role agents to talk to each other directly, each with its own Discord server and with group servers. This replaces entry 79's "through the coordinator only". It is planned with the owner when the roadmap reaches the project agents (85) and the company edition (79), next to AR0131.
