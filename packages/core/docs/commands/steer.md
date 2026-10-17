# arthur steer

Usage: `arthur steer <id> <text>`; on a channel `/steer <id> <text>`, the text being the rest of the message.

Gives a job in a run (`working`, `idle`, or held `blocked` by a plugin; see `arthur jobs --help`) one correction, the text as one quoted argument, which its agent gets after its next tool call, while the run goes on. The job is named by its full id or its short id (the 8 hex digits that end it, as `arthur jobs` shows it). Prints, or on a channel answers, `<id>: steer <number> queued for after its next tool call`, the full id.

How it reaches the agent: the steer is written whole into the record as `<home>/jobs/<id>/steer/inbox/<number>`, numbered on from `0001` over every steer the job had. The wrapper loads the steer extension into every job's agent (`-e steer.ts`, with `ARTHUR_JOB` naming the record); after each tool call it hands the agent every steer waiting in `inbox/`, oldest first, each as a user message delivered as a steer, moves it to `steer/done/`, and adds `steered <number>: <first line>` to the job's log. Two steers sent before the next tool call both arrive after it, in the order they were sent.

A steer still in `inbox/` when the job ends (the agent made no tool call after it) is moved to `steer/undelivered/`, the log saying `undelivered steer <number>: <first line>`, and `job-ended` names it: its data has `undelivered`, the numbers, when there is one. A later `arthur continue` does not deliver it; give the correction as the instruction instead.

A job on another machine (its record's `machine`; see `arthur spawn --help`) is steered there: over SSH, `arthur remote-job steer` queues the text, given on its stdin, in the record there, and its agent there gets it as above.

Refused (exit code 1, the reason after `arthur steer: `):

- An id with no record in `<home>/jobs/`: `<id>: no such job in <home>/jobs`.
- A short id that matches two jobs: `<id> matches 2 jobs: <id>, <id>; name one by its full id`.
- A job not in a run: `<id> is <state> (<reason>), not in a run; a steer reaches only a job in a run, and arthur continue resumes an ended or blocked worker`.
- A job that ended while the steer was written: `<id>: the job ended before its next tool call; steer <number> was not delivered; arthur continue <id> with it`. The steer is in `steer/undelivered/`.
- An empty argument, the id or the text (`""`): wrong usage, the usage line and exit code 2, before anything is steered. A text of only spaces: `the text is empty`.
- On another machine, each refusal above comes from there, after `machine <name>: arthur remote-job steer: `. A machine that does not answer: `machine <name>: ssh <ssh>: <ssh's last line>`. A machine no plugin registers now: `<id> runs on machine <name>, which no plugin registers; machines: <names>`.
- A config or a plugin that does not load: `arthur.config.ts did not load:`, then the reasons.

On a channel a refusal is the reply `/steer failed: <reason>`.

Wrong usage (not one id and one text, a flag) prints the usage line and exits 2; on a channel, a message without an id and a text gets `usage: /steer <id> <text>`.
