# arthur steer

Usage: `arthur steer <id> <text>`

Gives a running job one correction, the text as one quoted argument, which its agent gets after its next tool call, while the run goes on. Prints `<id>: steer <number> queued for after its next tool call`.

How it reaches the agent: the steer is written whole into the record as `<home>/jobs/<id>/steer/inbox/<number>`, numbered on from `0001` over every steer the job had. The wrapper loads the steer extension into every job's agent (`-e steer.ts`, with `ARTHUR_JOB` naming the record); after each tool call it hands the agent every steer waiting in `inbox/`, oldest first, each as a user message delivered as a steer, moves it to `steer/done/`, and adds `steered <number>: <first line>` to the job's log. Two steers sent before the next tool call both arrive after it, in the order they were sent.

A steer still in `inbox/` when the job ends (the agent made no tool call after it) is moved to `steer/undelivered/`, the log saying `undelivered steer <number>: <first line>`, and `job-ended` names it: its data has `undelivered`, the numbers, when there is one. A later `arthur continue` does not deliver it; give the correction as the instruction instead.

Refused (exit code 1, the reason after `arthur steer: `):

- An id with no record in `<home>/jobs/`: `<id>: no such job in <home>/jobs`.
- A job that is not running: `<id> is <state>, not running; a steer reaches only a running job, and arthur continue resumes an ended worker`.
- A job that ended while the steer was written: `<id>: the job ended before its next tool call; steer <number> was not delivered; arthur continue <id> with it`. The steer is in `steer/undelivered/`.
- An empty text: `the text is empty`.
- A config or a plugin that does not load: `arthur.config.ts did not load:`, then the reasons.

Wrong usage (not one id and one text, a flag) prints the usage line and exits 2.
