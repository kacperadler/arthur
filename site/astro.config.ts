import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://kacperadler.github.io",
	base: "/arthur",
	integrations: [
		starlight({
			title: "Arthur",
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/kacperadler/arthur" }],
			components: { MarkdownContent: "./src/components/MarkdownContent.astro" },
		}),
	],
});
