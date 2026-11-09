import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The proof behind an owner's answer (AR0664): his own channel message, as the inbox keeps it (inbox.ts), holding its words.
// Text from anywhere else (a forward, a job's message, the terminal) never answers for him: docs/commands/decision.md, "Answering".

// Whether `text` holds `words`, case and spacing ignored, neither starting nor ending inside a word.
function holds(text: string, words: string): boolean {
	const chars = [...words.replace(/\s+/g, "")].map((char) => char.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"));
	return new RegExp(`(?<![\\p{L}\\p{N}])${chars.join("\\s*")}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

// The number of the latest owner message that holds `words`, and names `id` too when given, else why none does: a message of
// the turn in progress, or one answered since the second after `asked` (ms); a channel's only, never one holding a forward.
// `answered/` is listed after the turn, so a file the extension moves between them meanwhile is still found.
export function proof(folder: string, words: string, asked: number, id?: string): number | string {
	const found = ["turn", "answered"].flatMap((box) => {
		const dir = join(folder, "inbox", box);
		return (existsSync(dir) ? readdirSync(dir) : []).flatMap((name) => {
			const [, seq, ms] = /^(\d+)-(\d+)$/.exec(name) ?? [];
			if (seq === undefined || (box === "answered" && !(Number(ms) >= asked + 1000))) return [];
			let message: { readonly channel?: unknown; readonly text?: unknown } | null;
			try {
				message = JSON.parse(readFileSync(join(dir, name), "utf8"));
			} catch {
				return [];
			}
			const { channel, text } = message ?? {};
			return typeof channel === "string" && channel !== "" && typeof text === "string" && !text.includes("[forwarded from ") && holds(text, words) ? [{ seq: Number(seq), text }] : [];
		});
	});
	const named = id === undefined ? found : found.filter((each) => holds(each.text, id));
	if (named.length > 0) return Math.max(...named.map((each) => each.seq));
	if (found.length > 0) return `the owner's message must name ${id} too, as in "${id} yes"; ask him to answer with its id`;
	return "no message of the owner holds these words: his own [via <channel>] message of this turn, or one sent after the question was asked, never a forward or the terminal; quote his words exactly as he wrote them";
}
