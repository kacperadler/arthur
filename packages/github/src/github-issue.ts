import { ask, CUT, field, pages, type Repository } from "./github-api.ts";
import { day, fileText, quoted, text, titled } from "./github-command.ts";
import { comment, comments } from "./github-comments.ts";

// `arthur github issue list [--all]|get <n>|create <file>|comment <n> <file>|label <n> <label>|close <n>` (AR0559): a
// repository's issues, newest update first, one of them with its labels and comments, each text people wrote on GitHub after
// `> `, and one created, commented on, labelled or closed. GitHub's issues API serves pull requests too: a list drops them and
// a number of one is refused. docs/commands/github-issue.md.

const NEEDS = "Issues: read";
const WRITE = "Issues: read and write";

// Writes its output; a refusal throws.
export async function issue(each: Repository, verb: string, words: readonly string[], all: boolean): Promise<number> {
	const { repo, instance } = each;
	const signal = new AbortController().signal;
	if (verb === "create") {
		const { title, body } = titled(words[0] ?? "");
		const made = await ask(instance, `/repos/${repo}/issues`, `an issue in ${repo}`, WRITE, signal, "POST", { title, body });
		if (!("body" in made)) throw new Error(made.text);
		return (console.log(`created issue #${text(field(made.body, "number"))}: ${text(field(made.body, "html_url"))}`), 0);
	}
	if (verb === "list") {
		const listed = await pages(instance, `/repos/${repo}/issues?state=${all ? "all" : "open"}&sort=updated&direction=desc`, `the issues of ${repo}`, NEEDS, signal);
		if (!("items" in listed)) throw new Error(listed.text);
		const items = listed.items.filter((item) => field(item, "pull_request") === undefined);
		const lines = items.flatMap((item) => [`#${text(field(item, "number"))} ${state(item)}, by ${text(field(field(item, "user"), "login"))}, updated ${day(field(item, "updated_at"))}`, ...quoted(field(item, "title"))]);
		console.log([...(items.length === 0 ? [`no ${all ? "" : "open "}issues in ${repo}`] : lines), ...(listed.cut ? [`the issues ${CUT}`] : [])].join("\n"));
		return 0;
	}
	const [number = ""] = words;
	if (!/^[1-9]\d*$/.test(number)) throw new Error(`${number} is not an issue number such as 12; nothing was asked of GitHub`);
	const what = `issue #${number} of ${repo}`;
	const note = verb === "comment" ? fileText(words[1] ?? "") : "";
	const got = await ask(instance, `/repos/${repo}/issues/${number}`, what, NEEDS, signal);
	if (!("body" in got)) throw new Error(got.text);
	const item = got.body;
	if (field(item, "pull_request") !== undefined)
		throw new Error(`#${number} is a pull request: ${verb === "label" ? "arthur github labels issues only" : `arthur github pr ${verb} ${number}${verb === "comment" ? " <file>" : ""}`}${verb === "get" ? "" : "; nothing was written"}`);
	if (verb === "comment") return (console.log(await comment(each, number, note, what, WRITE, signal)), 0);
	const labels = (Array.isArray(field(item, "labels")) ? (field(item, "labels") as readonly unknown[]) : []).map((label) => text(field(label, "name")));
	if (verb === "label") {
		const wanted = words[1] ?? "";
		const known = await pages(instance, `/repos/${repo}/labels`, `the labels of ${repo}`, NEEDS, signal);
		if (!("items" in known)) throw new Error(known.text);
		// Matched in any case, and only a name the repository has is sent: GitHub adds a label it lacks, so a typo would make one.
		const name = known.items.map((label) => text(field(label, "name"))).find((label) => label.toLowerCase() === wanted.toLowerCase());
		if (name === undefined) throw new Error(`${repo} has no label ${wanted}, in any case; nothing was written`);
		if (labels.some((label) => label.toLowerCase() === wanted.toLowerCase())) throw new Error(`${what} has the label ${wanted} already; nothing was written`);
		const added = await ask(instance, `/repos/${repo}/issues/${number}/labels`, `the labels of ${what}`, WRITE, signal, "POST", { labels: [name] });
		if (!("body" in added)) throw new Error(added.text);
		return (console.log([`label added to ${what}:`, ...quoted(name)].join("\n")), 0);
	}
	if (verb === "close") {
		if (field(item, "state") !== "open") throw new Error(`${what} is closed already; nothing was written`);
		const closed = await ask(instance, `/repos/${repo}/issues/${number}`, what, WRITE, signal, "PATCH", { state: "closed", state_reason: "completed" });
		if (!("body" in closed)) throw new Error(closed.text);
		return (console.log(`closed ${what} as completed`), 0);
	}
	const said = await comments(each, number, what, NEEDS, signal);
	const dates = (["created", "updated", "closed"] as const).flatMap((word) => (typeof field(item, `${word}_at`) === "string" ? [`${word} ${day(field(item, `${word}_at`))}`] : []));
	const body = quoted(field(item, "body"));
	const named = labels.flatMap(quoted);
	console.log(
		[
			...[`issue #${number} of ${repo}: ${state(item)}`, `by ${text(field(field(item, "user"), "login"))}; ${dates.join(", ")}`, text(field(item, "html_url")), "title:", ...quoted(field(item, "title"))],
			...(named.length === 0 ? ["labels: none"] : ["labels:", ...named]),
			...(body.length === 0 ? ["body: none"] : ["body:", ...body]),
			...said,
		].join("\n"),
	);
	return 0;
}

// `open` or `closed`, and GitHub's reason a closed one was closed, `completed` or `not_planned`, when it says one.
function state(item: unknown): string {
	const reason = field(item, "state") === "closed" ? text(field(item, "state_reason")) : "";
	return `${text(field(item, "state"))}${reason === "" ? "" : `, ${reason}`}`;
}
