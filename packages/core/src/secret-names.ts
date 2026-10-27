import { readFileSync, statSync } from "node:fs";
import { parseEnvFile } from "./env.ts";

// The one place a secret's value becomes its variable's name (AR0518), before Arthur writes it: in a job's record and log, the
// event log (so every notice and channel message made of an event), a channel's reply to a phone command, and every text the CLI
// prints. A value under 8 characters is no secret: replacing it would garble common text.
export type Hide = (text: string) => string;

// `named`: values by variable name, replaced in one pass, the longest first, so a value inside another never splits it.
export function secretNames(named: Readonly<Record<string, string>>): Hide {
	const names = new Map(Object.entries(named).flatMap(([name, value]) => (value.length >= 8 ? [[value, name] as const] : [])));
	const any = new RegExp([...names.keys()].sort((a, b) => b.length - a.length).map((value) => RegExp.escape(value)).join("|"), "g");
	return (text) => text.replace(any, (value) => names.get(value) ?? value);
}

// The wrapper's, which loads no config: every value of the env files its job's record names (`hidden`, job-sandbox.ts); a path
// that is no file (the `~/.ssh` folder, a file gone) names nothing.
export function envFileNames(files: readonly string[]): Hide {
	return secretNames(Object.fromEntries(files.filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile()).flatMap((file) => [...parseEnvFile(readFileSync(file, "utf8"), file).values])));
}

// Every text this process prints from here on; bytes written as they are (a child's output piped through) are not read.
export function printNames(hide: Hide): void {
	for (const stream of [process.stdout, process.stderr]) {
		const write = stream.write.bind(stream) as (chunk: unknown, ...rest: unknown[]) => boolean;
		stream.write = ((chunk: unknown, ...rest: unknown[]) => write(typeof chunk === "string" ? hide(chunk) : chunk, ...rest)) as typeof stream.write;
	}
}
