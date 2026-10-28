# AR0489 - Outcome

- Merged: 2026-10-28, `58e1232e`
- Branch: arthur/2026-10-28-worker-868f32b2
- Reviews: review-1.md PASS
- Cost: worker $3.00, reviews $1.71; review rounds 1

## What went in

- A coordinator option ending in `;` (a model, the quick model, a variable, the folder, an extension file) reaches tmux as one argument, escaped as tmux 3.4 reads it, so it no longer ends the `new-session` command and runs what follows as a tmux command; the server's variable names get the same escape. A real-tmux test covers it on a host that allows Unix sockets (it passed on this server).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1191/1259 passed.

## Left open

- Findings: F1 dropped (the real-tmux test the job sandbox skips passed when the coordinator ran it on this server).
