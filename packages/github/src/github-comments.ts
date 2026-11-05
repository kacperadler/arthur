import { ask, CUT, field, pages, type Repository } from "./github-api.ts";
import { day, quoted, text } from "./github-command.ts";

// A pull request's or an issue's comments (AR0557), which GitHub serves alike through its issues comments API ("List issue
// comments"), oldest first: the lines to print, each comment's text after `> `. `what` names it and `needs` the token's
// permission on it, as a refusal says them; a refusal throws.
export async function comments({ repo, instance }: Repository, number: string, what: string, needs: string, signal: AbortSignal): Promise<string[]> {
	const listed = await pages(instance, `/repos/${repo}/issues/${number}/comments`, `the comments of ${what}`, needs, signal);
	if (!("items" in listed)) throw new Error(listed.text);
	if (listed.items.length === 0) return ["no comments"];
	const lines = listed.items.flatMap((each) => [`comment ${text(field(each, "id"))} by ${text(field(field(each, "user"), "login"))} on ${day(field(each, "created_at"))}`, ...quoted(field(each, "body"))]);
	return listed.cut ? [...lines, `the comments ${CUT}`] : lines;
}

// `body` added as a comment (AR0558, "Create an issue comment"): the line to print, with its id and page.
export async function comment({ repo, instance }: Repository, number: string, body: string, what: string, needs: string, signal: AbortSignal): Promise<string> {
	const made = await ask(instance, `/repos/${repo}/issues/${number}/comments`, `a comment on ${what}`, needs, signal, "POST", { body });
	if (!("body" in made)) throw new Error(made.text);
	return `comment ${text(field(made.body, "id"))} added to ${what}: ${text(field(made.body, "html_url"))}`;
}
