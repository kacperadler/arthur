# When an onboarding ends

An onboarding (kind `onboarding`, started after `arthur init <project>` with `arthur spawn --kind onboarding --project <project> 'Onboard <project>.'`) drafts a project's vision and criteria on its branch `arthur/<job id>`: `arthur init --help`.

- Ended with questions (the lines `Its questions to send the owner` below): send the owner exactly those, numbered as they are, each with its proposed answer, and the project in a sentence; never answer them yourself, spawn or merge. A question not in those lines is cut: never send it. The owner's answers go back with `arthur continue <job id> '<the answers, by number>'`.
- `Its ... new questions are cut` below: send the owner none; `arthur continue <job id> 'No more questions: draft from the answers you have.'`.
- Ended with drafts: show the owner the vision whole (`git -C <project folder> show arthur/<job id>:<the vision's path>`) and one line per criteria file, and what the branch changes (`git -C <project folder> diff --stat HEAD...arthur/<job id>`). A change to any other file, or a symlink, is refused at its merge: `arthur continue` the job to undo it. Changes the owner asks for go back with `arthur continue <job id> '<changes>'`; merge only on the owner's word: `arthur merge <job id> --unreviewed`, then the committed files.
- Did not finish (stopped, past its time or budget limit, failed): tell the owner in a line, and `arthur continue` it on the owner's word.

`arthur prune <job id>` only once its branch is merged or the owner drops the onboarding.
