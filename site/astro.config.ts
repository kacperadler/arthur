import { existsSync } from "node:fs";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://kacperadler.github.io",
	base: "/arthur",
	integrations: [
		starlight({
			title: "Arthur",
			favicon: existsSync(new URL("public/favicon.png", import.meta.url)) ? "/favicon.png" : "/favicon.svg",
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/kacperadler/arthur" }],
			components: { MarkdownContent: "./src/components/MarkdownContent.astro" },
		}),
	],
});
