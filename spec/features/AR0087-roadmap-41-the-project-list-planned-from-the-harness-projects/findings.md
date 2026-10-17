# AR0087 - Findings

## F1 - arthur_test_*.slice units stay active after interrupted test runs
- Status: dropped (residue of interrupted runs, not this branch; testing.ts cleans on exit; the coordinator stops the leftovers)
- Source: review-1

## F2 - The doctor check returns a bare "missing: no about" string
- Status: dropped (entry 80 sets the shape when it is built)
- Source: review-1
