import type { ReactElement } from "react";

import { footerGroups } from "@/lib/landing-content";

export function LandingFooter(): ReactElement {
	return (
		<footer className="border-t-2 border-ink bg-ink text-bone">
			<div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_2fr] lg:px-8">
				<div>
					<p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-circuit">
						devos.ing
					</p>
					<p className="mt-4 max-w-sm font-display text-3xl leading-tight">
						Agent runs, routed and reviewed.
					</p>
				</div>
				<div className="grid gap-8 sm:grid-cols-3">
					{footerGroups.map((group) => (
						<div key={group.title}>
							<h2 className="font-mono text-xs font-black uppercase tracking-[0.18em] text-circuit">
								{group.title}
							</h2>
							<ul className="mt-4 space-y-3 text-sm text-bone/78">
								{group.links.map((link) => (
									<li key={link.href}>
										<a className="hover:text-circuit" href={link.href}>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
			<div className="border-t border-bone/20 px-4 py-5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-bone/55">
				Agentic development hub
			</div>
		</footer>
	);
}
