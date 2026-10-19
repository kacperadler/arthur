import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { redact } from "./credential.ts";

// The start notice and the LLM probe (spec/roadmap.md, entry 38): at every start of `arthur run`, one word asked of the
// coordinator's model first, then one notice, `coordinator up on <host>` or `no LLM access on <host>: <reason>; run omp login`;
// and a notice for each coordinator turn that failed before any text, which the turn extension (turn-extension.ts) leaves in
// `turn-failed/`: docs/session.md, "The start notice".

export const TURN_FAILED = "turn-failed";
const PROBE_SECONDS = 60;
const QUESTION = "Answer with one word: ready.";

type Said = { readonly role?: string; readonly stopReason?: string; readonly errorMessage?: string; readonly content?: readonly { readonly type?: string; readonly text?: string }[] };

// The first line of `text`, its credentials redacted, at most 300 characters.
const line = (text: string) => redact(text.trim().split("\n")[0] ?? "").slice(0, 300);

// One word asked of `model` (the agent's default when undefined) with `agent` in print mode, no session, tool, extension, skill
// or rule; undefined when it answered with text, else why not. Cut after `ms`; `signal` kills it without an answer.
export function probe(agent: string, model: string | undefined, ms: number, signal?: AbortSignal): Promise<string | undefined> {
	const args = ["-p", "--no-session", "--no-title", "--no-tools", "--no-extensions", "--no-skills", "--no-rules", "--mode", "json", ...(model === undefined ? [] : ["--model", model]), QUESTION];
	const { promise, resolve } = Promise.withResolvers<string | undefined>();
	const child = spawn(agent, args, { stdio: ["ignore", "pipe", "pipe"], signal });
	const [out, err] = [[] as Buffer[], [] as Buffer[]];
	child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
	child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
	const timer = setTimeout(() => {
		child.kill("SIGKILL");
		resolve(`no answer within ${ms / 1000} s`);
	}, ms);
	child.on("error", (error) => {
		clearTimeout(timer);
		resolve(line(error.message));
	});
	child.on("close", (code, killed) => {
		clearTimeout(timer);
		const said = Buffer.concat(out)
			.toString("utf8")
			.split("\n")
			.flatMap((text) => {
				try {
					const event = JSON.parse(text) as { readonly type?: string; readonly message?: Said };
					return event.type === "message_end" && event.message?.role === "assistant" ? [event.message] : [];
				} catch {
					return [];
				}
			});
		const failed = said.find((message) => message.stopReason === "error" || message.stopReason === "aborted");
		if (failed !== undefined) return resolve(line(failed.errorMessage || `the model's turn ended with ${failed.stopReason}`));
		if (said.some((message) => (message.content ?? []).some((block) => block.type === "text" && (block.text ?? "").trim() !== ""))) return resolve(undefined);
		const errors = Buffer.concat(err).toString("utf8").split("\n");
		const shown = errors.find((text) => text.startsWith("error: "))?.slice("error: ".length) ?? errors.find((text) => text.trim() !== "");
		resolve(line(shown ?? (killed ? `ended by ${killed}` : code === 0 ? "no answer" : `exit code ${code}`)));
	});
	return promise;
}

// At `arthur run`'s start: the probe unless `probeLlm` is false, then the start notice, opening with the lines `arthur doctor`
// found missing that this start sends. Returns what stops the probe.
export function startNotice(host: Host, probeLlm: boolean, missing: readonly string[]): () => void {
	const here = hostname();
	const quit = new AbortController();
	const asked = async () => {
		if (!probeLlm) return undefined;
		const [answer] = host.collect<{ readonly model?: unknown } | undefined>("roles.model", "coordinator");
		return probe(host.agent, typeof answer?.model === "string" ? answer.model : undefined, PROBE_SECONDS * 1000, quit.signal);
	};
	asked()
		.catch((error: Error) => line(error.message))
		.then((reason) => {
			if (quit.signal.aborted) return;
			const text = reason === undefined ? `coordinator up on ${here}` : `no LLM access on ${here}: ${reason}; run omp login`;
			host.events.emit("notice", { text: [...missing, text].join("\n") });
		});
	return () => quit.abort();
}

// Every 500 ms in `arthur run`: one notice per turn failure the turn extension left, oldest first, and one for each mark that
// turns work again after one told. One left before this `arthur run` started is dropped, not told late.
export function turnFailures(host: Host): () => void {
	const [folder, began, here] = [join(host.folder, TURN_FAILED), Math.floor(performance.timeOrigin), hostname()];
	return () => {
		if (!existsSync(folder)) return;
		const names = readdirSync(folder)
			.filter((name) => /^\d+-\d+-\d+\.(txt|ok)$/.test(name))
			.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
		for (const name of names) {
			const file = join(folder, name);
			const reason = readFileSync(file, "utf8").trim();
			rmSync(file, { force: true });
			if (Number(name.split("-")[0]) < began) continue;
			host.events.emit("notice", { text: name.endsWith(".ok") ? `turns work again on ${here}` : `turn failed on ${here}: ${line(reason) || "no reason given"}` });
		}
	};
}
