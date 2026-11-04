# arthur repeats

Usage: `arthur repeats [--project <name>] [--since <date|decision id>]`, `arthur repeats [--project <name>] --retro ['<focus>']`, and `/repeats [retro [<focus>]]` on a channel. Comes with the `manage` plugin (AR0562). The digest is answered without the model, for one project, the main one unless `--project` names another, and reads only: nothing is written but the phone page in manage's own folder.

What the owner decides again and again, and what the agents keep hitting, as Markdown. The decisions come from the project's decision log (`arthur decision --help`) as the orchestration plugin parses it (`decision.entries`); the issues from the board and the files in each ticket's folder.

`--since` starts the digest at a date, `YYYY-MM-DD`, the asks of that day or later by their own date and the tickets whose JSON block's `date` is that day or later; or at a decision id, `AR-D12`, the asks from that one on in the log's order and the tickets made on its day or later. Left out: the whole log and every ticket.

## The digest

`# Repeats of <project>`, `Since <date|id>.` or `Since the start.`, then:

- `## Decisions by kind and by who answered`: the first and last id and day, the asks, answered, closed and open; one line per kind, most asked first, `- <kind>: <n> asks; policy <n>, standing grant <n>, owner <n>, closed <n>; agreement <a> of <b> (<%>)`; a line over every kind but `class`, each source as a share; and the classes as they stand now (`proposed`, `approved`, `refused`, `revoked`, `closed`). Who answered is read from the answer the coordinator recorded, its latest one:
  - `policy`: its words are `by policy: <class id>`;
  - `standing grant`: its words quote one of the owner's blanket grants (`do not ask`, `don't ask`, `not ask me`, `always go with`, `just merge`, `by yourself`, `go with your recommendation`, `go with all recommendation`, `nie pytaj`) and do not name the question's own id;
  - `owner`: any other answer: a fresh reply, or one message answering a list of questions;
  - `closed`: closed with no answer; `open`, shown only when one is, neither.
  - The agreement counts the answers by the owner or a grant on a question with a numeric recommendation and a pick: the pick is the recommended option.
- `## Repeated shapes`: the questions (classes left out) grouped by their kind and the first 2 words of each option, parentheses, ids (`AR0441`, `AR-D12`) and numbers left out, each number one `#` (`budget: accept # / ask the`), or by the question's first 4 words when it offers no option. Each shape with 3 or more asks, most first, `### <n>. \`<shape>\`: <n> asks`:
  - `First asked:` its first id and question; `Answered:` the sources; `Picks:` the options picked by the owner or a grant, by the same first 2 words; `Agreement with the recommendation:`; `Examples:` up to 6 ids, the first 4 and the last of a longer list.
  - `Class:` each class of the shape's kind that names one of its asks as a class matches (every word of its match in the question, and the ticket's `- Kind:` when the class has a ticket kind), with its state and how many of the asks it names; `none`.
  - `Candidate:` the first that holds: `covered by <class id>`, an approved class naming every ask; `picks split: a code default`, the owner's picks went to two options or more, so no class decides it; a ready line, `` `arthur decision class propose --project <p> --kind <k> --match '<the words every question of the shape names>' --decided '<decision>' --backed-by <ids>` ``, when 3 or more answers by the owner or a grant decided the same (in any case and spacing), run as it stands (`arthur decision class propose --help`); `decided texts differ: one fresh owner answer backs a class`; `no answer by the owner or a grant to back a class`; `no word common to every question: no class matches them all`.
- `## Standing grants`: the standing-grant answers grouped by the grant they quote: an answer naming another decision goes under it (`under AR-D271`), joining the group that decision began; any other under the first answer whose words begin as its words do, or begin its words (`first AR-D61`). Each with the grant's words, the answers and their kinds, and the ids.
- `## The owner's overrides of the recommendation`: the scored answers whose pick is not the recommended option, each with both options and the question.
- `## Loose class matches`: the answers by policy whose question names the class's words apart, not as one phrase, such as `passed review` in `no review ran; checks passed`: the matches to check by hand.
- `## Recurring issues`, from the tickets of the period:
  - the share of tickets with a `Source: F<n> of <ticket>` line, and the longest chain of them, `AR0304 ← AR0298 ← … ← AR0256`;
  - the tickets with 2 or more `review-N.md` files saying `- Verdict: FAIL`, the 5 with most;
  - the questions of jobs blocked on the owner (kind `job`, with a job) by cause: `line budget` (the question names a budget), `file size` (a `<n>-line` limit), `other`;
  - per package (each folder in the project's `packages/`), the tickets whose Decisions name its line budget: a line with `budget` naming the package before a number, `core 100 to 110`, `core line budget 110 -> 120`; `no packages/ folder` without one;
  - the dropped tickets, from a finding or other.

With no decision in the period the decisions are `None in the log.`, the issues still read.

## The page

`/repeats` writes the main project's digest as one self-contained page, `.arthur/manage/repeats-<date>.html` (`<date>` today in `core.timeZone`, written to a temporary name and renamed), and sends it as a file through the channel the command came from, to its place, as `/retro` sends a page (`arthur retro --help`): `repeats-<date>.html: <channel>: <what the channel said>`, or why it was not sent. The page follows the base style of `.agents/arthur/criteria/report.md`: ink `#0a0a0a` on white with blue `#0033ff` as the accent, one light colour scheme, a black header holding the title and the `Since` line, then the sections in a centred `main` at most 900 px wide, their headings centred, each backticked span as `code` on grey, each list a list, and red `#d40000` only for the lines of the overrides and the loose matches.

## The decisions retro

`arthur repeats --retro ['<focus>']` and `/repeats retro [<focus>]` start the retro kind (docs/manage.md, "The retro") and print `retro: started job <id>`. Its task is the retro's own with `Focus: decisions: <focus>` under it (`Focus: decisions` without a focus); its prompt, as every retro's, holds this digest for the retro's period, from the day of the last retro's commit. `/retro` alone never starts a job: it sends the newest retro's page.

## Refusals

- More than `--since <date|id>` and `--project`, a `--since` that is neither a date nor a decision id, `--since` with `--retro`, words without `--retro`, or two after it: `usage: arthur repeats [--project <name>] [--since <date|decision id>], or arthur repeats [--project <name>] --retro ['<focus>']`, exit 2; more than `retro [<focus>]` after `/repeats`: `usage: /repeats [retro [<focus>]]`.
- An id the log does not hold: `no decision <id> in the log of project <project>`, exit 1.
- An unknown project, exit 1 with the board's refusal; a decision log broken by hand, exit 1 with orchestration's refusal naming the line; orchestration not loaded, exit 1 (`call("decision.entries"): no plugin provides it`).
- Inside a job (`arthur help --help`) the command is refused before it runs; a retro's prompt already holds the digest.
