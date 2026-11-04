# AR0622 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A Discord gateway close its peer never answers leaves its TCP socket open

- Kind: perf
- Found by: 2026-11-04-worker-e10a52d3 (worker), 2026-11-04
- Where: `packages/discord/src/gateway.ts:100`
- What: Node 24's WebSocket stays CLOSING with no time limit when the peer never answers a close frame (a throwaway probe against a peer that completed the handshake and then went silent: no `close` event 15 s after `close(1000)`, `readyState` 2). Since this branch the gateway goes on after 5 s, but the WebSocket object and its TCP socket stay until the OS ends the connection: over a long outage, each heartbeat with no ACK can leave one more behind in `arthur run`.
- Suggestion: find out how long Linux keeps such a socket (TCP keepalive and retransmission limits for undici's socket), and, if it is long, end it through a public way when one exists; nothing in WHATWG's WebSocket API destroys the socket today. Out: the 5 s bound itself.
- Status: open
