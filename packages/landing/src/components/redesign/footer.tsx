import type { ReactElement } from "react";

const columns = [
	{
		title: "Product",
		links: [
			{ href: "#flow", label: "Workflow" },
			{ href: "#board", label: "Board" },
			{ href: "#inbox", label: "Telegram inbox" },
			{ href: "#platform", label: "Changelog" },
		],
	},
	{
		title: "Developers",
		links: [
			{ href: "#docs", label: "Docs" },
			{ href: "#start", label: "CLI reference" },
			{ href: "#crew", label: "Examples" },
			{ href: "https://github.com/1997roylee/devos.ing", label: "GitHub" },
		],
	},
	{
		title: "Community",
		links: [
			{ href: "#inbox", label: "Discord" },
			{ href: "#inbox", label: "Twitter" },
			{ href: "#inbox", label: "Discussions" },
			{ href: "#inbox", label: "Contributing" },
		],
	},
];

export function Footer(): ReactElement {
	return (
		<footer className="border-foreground border-t-2 bg-card">
			<div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16 md:grid-cols-5">
				<div className="col-span-2">
					<div className="flex items-center gap-2">
						<div className="relative h-6 w-6 border-2 border-foreground bg-[var(--neon-pink)]">
							<div className="-bottom-1 -right-1 absolute -z-10 h-6 w-6 border-2 border-foreground bg-[var(--neon-cyan)]" />
						</div>
						<span className="font-pixel text-xl tracking-tight">devos.ing</span>
					</div>
					<p className="mt-4 max-w-xs text-muted-foreground text-sm">
						Code is cheap, show me your agent system.
					</p>
				</div>
				{columns.map((column) => (
					<div key={column.title}>
						<div className="mb-4 text-muted-foreground text-xs uppercase tracking-[0.15em]">
							{column.title}
						</div>
						<ul className="space-y-2.5 text-sm">
							{column.links.map((link) => (
								<li key={link.label}>
									<a
										className="text-foreground/80 hover:underline"
										href={link.href}
									>
										{link.label}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
			<div className="border-border/60 border-t">
				<div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-muted-foreground text-xs sm:flex-row sm:px-6 sm:text-left">
					<div>{"\u00A9"} 2026 devos.ing - open source, runs locally</div>
					<div className="font-mono">v0.0.1 / MIT</div>
				</div>
			</div>
		</footer>
	);
}
