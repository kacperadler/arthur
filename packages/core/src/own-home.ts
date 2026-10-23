import { chmodSync, mkdirSync, statSync } from "node:fs";

// The home folder made, or kept, Arthur's user's alone (AR0370): every record, log, lock and plugin folder lies under it, so
// its mode denies another user of the host all of them, whatever the umask gave each. `mkdirSync`'s mode is masked by the
// umask and applies to a new folder only; `chmodSync` is not, and drops the group's and others' bits from a home made earlier
// (`755` under umask 022). The owner's own bits stay, so a home made read-only is still refused as not writable.
export function ownHome(home: string): void {
	mkdirSync(home, { recursive: true, mode: 0o700 });
	chmodSync(home, statSync(home).mode & 0o700);
}
