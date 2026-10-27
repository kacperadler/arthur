import { readFileSync, statSync } from "node:fs";
import { parseEnvFile } from "./env.ts";

// The one place a secret's value becomes its variable's name (AR0518), before Arthur writes it: in a job's record and log, the
// event log (so every notice and channel message made of an event), a channel's reply to a phone command, and every text the CLI
// prints. A value under 8 characters is no secret: replacing it would garble common text.
// `values`: the values named, the longest first; `bytes` names them in bytes, each value as its UTF-8.
export type Hide = ((text: string) => string) & { readonly values: readonly string[]; readonly bytes: (chunk: Uint8Array) => Buffer };

// `named`: values by variable name, replaced in one pass, the longest first, so a value inside another never splits it.
export function secretNames(named: Readonly<Record<string, string>>): Hide {
	const kept = Object.entries(named).filter(([, value]) => value.length >= 8);
	// Bytes as latin1 text, one character per byte, so a byte sequence a chunk cuts short stays as it was.
	const latin = replacer(kept.map(([name, value]) => [name, Buffer.from(value).toString("latin1")]));
	const values = kept.map(([, value]) => value).sort((a, b) => b.length - a.length);
	return Object.assign(replacer(kept), { values, bytes: (chunk: Uint8Array) => Buffer.from(latin(Buffer.from(chunk).toString("latin1")), "latin1") });
}

function replacer(pairs: readonly (readonly [string, string])[]): (text: string) => string {
	const names = new Map(pairs.map(([name, value]) => [value, name]));
	const any = new RegExp([...names.keys()].sort((a, b) => b.length - a.length).map((value) => RegExp.escape(value)).join("|"), "g");
	return (text) => text.replace(any, (value) => names.get(value) ?? value);
}

// A stream's text, chunk by chunk, to `write` named: a chunk's end that may start a value waits for the next chunk or `end`,
// so a value a pipe split across two chunks is named whole; the rest is written at once.
export function namedChunks(hide: Hide, write: (text: string) => void): { push(chunk: string): void; end(): void } {
	let held = "";
	return {
		push(chunk) {
			const text = hide(held + chunk);
			let cut = Math.max(0, text.length - (hide.values[0]?.length ?? 0) + 1);
			while (cut < text.length && !hide.values.some((value) => value.startsWith(text.slice(cut)))) cut++;
			write(text.slice(0, cut));
			held = text.slice(cut);
		},
		end: () => write(held),
	};
}

// The wrapper's, which loads no config: every value of the env files its job's record names (`hidden`, job-sandbox.ts); a path
// that is no file (the `~/.ssh` folder, a file gone) names nothing.
export function envFileNames(files: readonly string[]): Hide {
	return secretNames(Object.fromEntries(files.filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile()).flatMap((file) => [...parseEnvFile(readFileSync(file, "utf8"), file).values])));
}

// Every text and every byte this process writes to stdout and stderr from here on, a value two writes split excepted; an
// uncaught exception, an unhandled rejection among them (Node raises it as one), which Node would print as it is, is printed
// here, named, and ends the process with Node's code for it, 1.
export function printNames(hide: Hide): void {
	for (const stream of [process.stdout, process.stderr]) {
		const write = stream.write.bind(stream) as (chunk: unknown, ...rest: unknown[]) => boolean;
		stream.write = ((chunk: unknown, ...rest: unknown[]) => write(typeof chunk === "string" ? hide(chunk) : chunk instanceof Uint8Array ? hide.bytes(chunk) : chunk, ...rest)) as typeof stream.write;
	}
	const fail = (error: unknown) => {
		process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
		process.exit(1);
	};
	process.on("uncaughtException", fail);
}
