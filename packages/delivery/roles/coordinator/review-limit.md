# When a branch has 2 FAIL reviews

The branch failed review twice since its last PASS: a third review is refused, and the owner decides what comes next (`arthur review --help`). Spawn nothing on this branch until he does.

1. File every review of the branch not filed yet, `arthur ticket file <ticket id> <review job>`, and commit them; then read the findings of both FAILs in the ticket's `review-N.md` files.
2. Pick the recommendation:
   - the same finding in both FAILs: fix or split the ticket and start again;
   - different findings, each smaller than the last: a third round;
   - the wrong approach, or a cost above the value: drop the branch.
3. Send the owner, in plain words, at most 3 lines per item, the ticket described in a sentence: what failed twice; your recommendation with a one-sentence reason; the two other options, each with what it means in practice.

On the owner's word only: another round is `arthur review <worker job> --round <N>`, N the FAILs plus one (3 after 2 FAILs), after the worker fixed the findings (`arthur continue <worker job> '<the findings>'`); fixing the ticket is an edit of its `ticket.md` and a new worker, whose new branch starts the count again; dropping is `arthur ticket status <ticket id> dropped`.
