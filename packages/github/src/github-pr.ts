import { ask, CUT, field, pages, type Repository } from "./github-api.ts";
import { day, fileText, quoted, text, titled } from "./github-command.ts";
import { comment, comments } from "./github-comments.ts";
import { git } from "./github-git.ts";

// `arthur github pr list [--all]|get <n>|create <branch> <file> [--base <branch>]|comment <n> <file>|close <n>|merge <n>` (AR0557,
// AR0558): a repository's pull requests, newest update first, one of them with its comments and reviews, each text people wrote
// on GitHub after `> `, and one created, commented on or closed; `pr merge` only refuses, since a merge on GitHub would put a
// commit on origin's main that no `arthur merge` review or CI check covered. docs/commands/github-pr.md.

const NEEDS = "Pull requests: read";
const WRITE = "Pull requests: read and write";

// Writes its output; a refusal throws.
export async function pr(each: Repository, verb: string, words: readonly string[], all: boolean, base?: string): Promise<number> {
	if (verb === "merge") throw new Error("a merge is arthur merge <job> --decision <the owner's decision id>; the push of main marks the pull request merged; nothing was asked of GitHub");
	const { repo, instance } = each;
	const signal = new AbortController().signal;
	if (verb === "create") {
		const [head = "", file = ""] = words;
		const { title, body } = titled(file);
		const onto = base ?? git(each.path, "symbolic-ref", "--quiet", "--short", "HEAD");
		if (onto === undefined) throw new Error(`the checkout of project ${each.project} is on no branch to be the base; give --base <branch>; nothing was asked of GitHub`);
		if (onto === head) throw new Error(`${head} is the base too: a pull request asks to merge a branch into another; nothing was asked of GitHub`);
		const made = await ask(instance, `/repos/${repo}/pulls`, `a pull request of ${head} into ${onto} in ${repo}`, WRITE, signal, "POST", { title, head, base: onto, body });
		if (!("body" in made)) throw new Error(made.text);
		return (console.log(`created pull request #${text(field(made.body, "number"))}: ${text(field(made.body, "html_url"))}`), 0);
	}
	if (verb === "list") {
		const listed = await pages(instance, `/repos/${repo}/pulls?state=${all ? "all" : "open"}&sort=updated&direction=desc`, `the pull requests of ${repo}`, NEEDS, signal);
		if (!("items" in listed)) throw new Error(listed.text);
		if (listed.items.length === 0) return (console.log(`no ${all ? "" : "open "}pull requests in ${repo}`), 0);
		const lines = listed.items.flatMap((item) => [`#${text(field(item, "number"))} ${state(item)}, ${refs(item)}, by ${login(item)}, updated ${day(field(item, "updated_at"))}`, ...quoted(field(item, "title"))]);
		console.log([...lines, ...(listed.cut ? [`the pull requests ${CUT}`] : [])].join("\n"));
		return 0;
	}
	const [number = ""] = words;
	if (!/^[1-9]\d*$/.test(number)) throw new Error(`${number} is not a pull request number such as 12; nothing was asked of GitHub`);
	const what = `pull request #${number} of ${repo}`;
	const note = verb === "comment" ? fileText(words[1] ?? "") : "";
	const got = await ask(instance, `/repos/${repo}/pulls/${number}`, what, NEEDS, signal);
	// GitHub numbers issues and pull requests alike: a number no pull request has may be an issue's.
	if (!("body" in got)) throw new Error(got.status === 404 && verb === "comment" ? `${got.text}; it may be an issue: arthur github issue comment ${number}` : got.text);
	const item = got.body;
	if (verb === "comment") return (console.log(await comment(each, number, note, what, WRITE, signal)), 0);
	if (verb === "close") {
		if (field(item, "state") !== "open") throw new Error(`${what} is ${state(item).replace(", draft", "")} already; nothing was written`);
		const closed = await ask(instance, `/repos/${repo}/pulls/${number}`, what, WRITE, signal, "PATCH", { state: "closed" });
		if (!("body" in closed)) throw new Error(closed.text);
		return (console.log(`closed ${what}; its branch ${text(field(field(item, "head"), "ref"))} stays on origin`), 0);
	}
	const said = await comments(each, number, what, NEEDS, signal);
	const reviews = await pages(instance, `/repos/${repo}/pulls/${number}/reviews`, `the reviews of ${what}`, NEEDS, signal);
	if (!("items" in reviews)) throw new Error(reviews.text);
	// A pending review is a draft its author has not submitted.
	const submitted = reviews.items.filter((review) => field(review, "state") !== "PENDING");
	const dates = (["created", "updated", "closed", "merged"] as const).flatMap((word) => (typeof field(item, `${word}_at`) === "string" ? [`${word} ${day(field(item, `${word}_at`))}`] : []));
	const body = quoted(field(item, "body"));
	console.log(
		[
			...[`pull request #${number} of ${repo}: ${state(item)}`, `${refs(item)}, by ${login(item)}; ${dates.join(", ")}`, text(field(item, "html_url")), "title:", ...quoted(field(item, "title"))],
			...(body.length === 0 ? ["body: none"] : ["body:", ...body]),
			...said,
			...(submitted.length === 0 ? ["no reviews"] : []),
			...submitted.flatMap((review) => [`review ${text(field(review, "id"))} by ${login(review)}: ${text(field(review, "state"))} on ${day(field(review, "submitted_at"))}`, ...quoted(field(review, "body"))]),
			...(reviews.cut ? [`the reviews ${CUT}`] : []),
		].join("\n"),
	);
	return 0;
}

// `open`, `closed` or `merged`, and `, draft` for a draft.
function state(item: unknown): string {
	return `${typeof field(item, "merged_at") === "string" ? "merged" : text(field(item, "state"))}${field(item, "draft") === true ? ", draft" : ""}`;
}

// `<head> -> <base>`, each a branch's name.
function refs(item: unknown): string {
	return `${text(field(field(item, "head"), "ref"))} -> ${text(field(field(item, "base"), "ref"))}`;
}

function login(item: unknown): string {
	return text(field(field(item, "user"), "login"));
}
