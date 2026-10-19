# AR0174 - Roadmap: a decision log of what the owner decided when Arthur asked

```json
{
  "id": "AR0174",
  "title": "Roadmap: a decision log of what the owner decided when Arthur asked",
  "date": "2026-10-19"
}
```

## Description

A new roadmap entry: every time Arthur asks the owner for a decision and the owner answers, Arthur records it in a decision log. From this log Arthur can later decide such questions by itself.

## Goal

The owner (2026-10-19): "fajnie jak byśmy mieli jakiś decision log, jeśli Artur prosi o jakąś naszą decyzję, my to logujemy, to będzie potrzebne aby Artur stawał się coraz bardziej autonomiczny". The log is what moves the vision's own autonomy forward: what the owner decides once, Arthur can propose next time, then make by itself.

- Kind: improvement
- Budget: 4

## Done means

- `spec/roadmap.md` gains one entry with the next free number, in the section that fits (orchestration, or its own section), in the same shape as the others: Package, Delivers, Done means with edge cases, Depends on, Size, Covers. It says:
  - What is logged:
    - each decision the owner is asked for: a job blocked on the user (27), a question in the coordinator's reply, a planning ticket waiting for approval, a FAIL after the second round, a raise of a line budget;
    - the question, the options offered, the coordinator's recommendation, the owner's answer in his words, the time, the project and the ticket.
  - Where: one append-only file per project, in Git next to the board (for example `spec/decisions.jsonl`), written only through an `arthur decision` command, never by hand. A ticket's dated Decisions line is written from the same record, so the two never differ.
  - How the answer is matched to its question: the coordinator names the question's id in its reply, or records it with the command. Say what happens to a question with no answer.
  - How it is used:
    - the coordinator's context gets the decisions that matter for the current turn: similar questions and their answers;
    - `arthur decisions` lists and searches the log;
    - the log is the eval set (67) and the training data for the decision models (AR0129);
    - a later step, its own entry, lets a class of decisions the owner always answers the same way be proposed as pre-approved, like autopilot (29). Never without the owner's approval.
  - Secrets: an answer is redacted with the same rules as notices (AR0164) before it is written.
- README's table and `arthur.mmd` show the new entry as not built, with its dependencies, if the roadmap tests require it.
- `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md`, `README.md`, `arthur.mmd`.

Out:
- Any code: the entry is built later in its order.
- The decision models themselves: AR0129.

## Decisions

- 2026-10-19: Owner asked for this on Telegram ("dodaj to do roadmap"); that approves the ticket.
