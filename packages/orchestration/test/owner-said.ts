import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The owner's message `text`, event `seq`, as the inbox keeps it in `<folder>/inbox/<box>/<seq>-<ms>` (inbox.ts): what
// `arthur decision answer` looks for his words in (decision-proof.ts). `channel` null is a message of Arthur's own.
export function ownerSaid(folder: string, seq: number, text: string, { box = "turn", ms = Date.now(), channel = "telegram" as string | null } = {}): void {
	mkdirSync(join(folder, "inbox", box), { recursive: true });
	writeFileSync(join(folder, "inbox", box, `${seq}-${ms}`), JSON.stringify(channel === null ? { text } : { channel, text }));
}
