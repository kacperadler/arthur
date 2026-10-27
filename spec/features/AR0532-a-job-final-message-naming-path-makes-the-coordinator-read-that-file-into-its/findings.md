# AR0532 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. How omp 18 expands `@<path>` in a prompt's text, which no option of `sendUserMessage` turns off

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/orchestration/src/hand-over.ts:14`; omp 18.3.0, read from the JavaScript bundled in `~/.local/bin/omp` (`strings -n 8 ~/.local/bin/omp`), modules `packages/coding-agent/src/utils/file-mentions.ts` and `AgentSession`
- What: `extractFileMentions(text)` matches `/@(?:"([^"]+)"|'([^']+)'|([^\s@]+))/g` and keeps a match at the start of the text or right after a character of `/[\s([{<"'`]/`; a bare path loses leading `` `"'([{< `` and trailing `` )]}>.,;:!?"'` `` characters. `generateFileMentionMessages` resolves each against the session's cwd, reads a file up to 5 MB (an image up to 25 MB, a folder as its listing) and adds it to the turn as a `fileMention` message. `AgentSession`'s prompt path (`#So`) calls both on the text of every prompt it starts: `prompt()` (which `sendUserMessage` calls with only `attribution`, `expandPromptTemplates: false`, `images` and `streamingBehavior`; `deliverAs: "aside"` while idle takes it too) and a queued custom message such as a `session_stop` continuation (`#Ws` -> `#ar` -> `#So`). Only `synthetic: true`, which `sendUserMessage` never passes, skips `^`-mention expansion, not the file read; nothing skips the file read. `sendUserMessage` with `deliverAs: "steer"` or `"followUp"`, and `"aside"` while streaming, go to `#Rs`, which queues the message without reading mentions.
- Suggestion: done here: `handOver` puts a word joiner (U+2060) before each `@` omp would match, in every message's text; the test "an @<path> in a message's text reaches the agent as that text ..." in `packages/orchestration/test/inbox.test.ts` checks the content against omp's own pattern. A later omp that widens the characters before `@` needs `MENTION` widened with it.
- Status: fixed in 9077e115

## F2. A job's own session reads each file its task or a continue's text names as `@<path>`

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:89`; `packages/delivery/src/review-command.ts:83`; `packages/delivery/src/hand-back.ts:144`
- What: the wrapper starts a job as `omp -p ... @<record>/task`, and a continue as `omp --continue ... '<message>'`. omp 18.3.0's CLI (`processFileArguments`) puts the task file's content into the first message as `<file name="<path>">\n<content>\n</file>`, and print mode sends it with `session.prompt(text, { images })`, so the same `extractFileMentions` as in F1 runs over the task's whole text (read from the bundled source, not run: without an API key `#So` throws before it reads mentions). A review's task quotes the worker's final message under `## The worker's final message`, and a hand-back's continue quotes the review's final message, so an `@/etc/passwd` a worker or a reviewer writes makes the next job's omp read that file with the owner's rights, outside the job's sandbox. This is the case the reviewer of AR0487 reported. It is not this ticket's code path: the task and a continue's text go from the core's wrapper to omp's CLI, not through the coordinator's inbox; `steer.ts`'s `deliverAs: "steer"` takes `#Rs` and reads no mention.
- Suggestion: escape as `hand-over.ts` does in the text the core hands to omp, once, in the core: the `task` file as the wrapper's spawn writes it and the message of `arthur continue` (`host.jobs.continue`), so every plugin's task is covered; a test runs the fake agent and checks the exact task and continue text. The escape would be a second copy of `MENTION`, as the styleguide allows before a third use; the core cannot import the orchestration plugin.
- Status: open

## F3. The coordinator's handoff is handed back through `sendUserMessage` unescaped

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/session/src/handoff-extension.ts:64`
- What: after a restart or compaction the session plugin quotes the coordinator's handoff file and sends it with `pi.sendUserMessage(..., { attribution: "agent" })`, the path F1 describes. A handoff that copies an `@<path>` from a message it summed up (the inbox now hands it `\u2060@`, which a model may still write back as a plain `@`) makes omp read that file into the next session.
- Suggestion: put the word joiner before each such `@` of the quoted lines there too, with a test through the extension; out of this ticket's Scope (the session plugin).
- Status: open

## F4. A `^<model>` in a message's text gives the coordinator's session a model agent

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/orchestration/src/hand-over.ts:19`; omp 18.3.0 `expandMentions` (`packages/tui/src/prompt/model-mention-syntax.ts`, pattern `/(^|\s)\^([^\s^]+)(?=\s|$)/g`)
- What: in the same prompt path as F1, omp replaces a `^<model selector>` after whitespace that names an available model with `<model agent="m<n>" name="<name>"/>` and adds that model to the session as an agent (`appendCustomEntry`), for any text not marked `synthetic`. So a job's message or a review could add a model agent to the coordinator's session; it reads no file. Read from the bundled source, not run.
- Suggestion: a word joiner after each such `^` in `handOver`, with its own test; left out here since the ticket is the file read.
- Status: open
