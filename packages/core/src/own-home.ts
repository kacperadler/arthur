import { chmodSync, mkdirSync, statSync } from "node:fs";

// The home folder Arthur's user's alone whatever the umask (AR0370), so another user reads no record, log, lock or plugin folder
// under it. `chmodSync`, unlike `mkdirSync`'s mode, is not masked and fixes a home made earlier (`755` under umask 022); the
// owner's own bits stay, so a home made read-only is still refused as not writable.
export function ownHome(home: string): void {
	mkdirSync(home, { recursive: true, mode: 0o700 });
	chmodSync(home, statSync(home).mode & 0o700);
}
