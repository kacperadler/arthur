import { relative } from "node:path";
import type { TestEvent } from "node:test/reporters";

// A node:test reporter for GitHub Actions: one `::error` workflow command per failed test, titled with the test's
// name and carrying the first lines of its error, so a red run names its cause in the run's public annotations.
// The ci workflow adds it next to the spec reporter through NODE_OPTIONS.

const MAX_LINES = 8;
// Failures that only echo another one: a parent whose subtests failed, a test cancelled because its parent failed.
const ECHOES = ["subtestsFailed", "cancelledByParent"];

type Failure = Error & { readonly failureType?: string; readonly cause?: unknown };

export default async function* githubAnnotations(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
	for await (const event of source) {
		if (event.type !== "test:fail") continue;
		const { name, file, line, details } = event.data;
		const failure: Failure = details.error;
		if (ECHOES.includes(failure.failureType ?? "")) continue;
		const error = failure.cause ?? failure;
		const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
		const lines = text.split("\n").map((each) => each.trimEnd()).filter(Boolean).slice(0, MAX_LINES);
		const where = file === undefined ? "" : `file=${property(relative(process.cwd(), file))},line=${line ?? 1},`;
		yield `::error ${where}title=${property(name)}::${data(lines.join("\n"))}\n`;
	}
}

function data(text: string): string {
	return text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function property(text: string): string {
	return data(text).replaceAll(":", "%3A").replaceAll(",", "%2C");
}
