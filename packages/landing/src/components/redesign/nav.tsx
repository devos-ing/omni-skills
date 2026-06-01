import { ArrowUpRight } from "lucide-react";
import type { ReactElement } from "react";

export function Nav(): ReactElement {
	return (
		<nav className="sticky top-0 z-50 border-b-2 border-foreground bg-background/80 backdrop-blur-xl">
			<div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
				<div className="flex min-w-0 items-center gap-6 md:gap-10">
					<a className="flex items-center gap-2" href="/">
						<div className="relative h-6 w-6 border-2 border-foreground bg-[var(--neon-pink)]">
							<div className="-bottom-1 -right-1 absolute -z-10 h-6 w-6 border-2 border-foreground bg-[var(--neon-cyan)]" />
						</div>
						<span className="font-pixel text-xl tracking-tight">devos.ing</span>
					</a>
					<div className="hidden items-center gap-7 text-foreground/70 text-sm md:flex">
						<a className="transition hover:text-foreground" href="#platform">
							Platform
						</a>
						<a className="transition hover:text-foreground" href="#board">
							Board
						</a>
						<a className="transition hover:text-foreground" href="#inbox">
							Inbox
						</a>
						<a className="transition hover:text-foreground" href="#docs">
							Docs
						</a>
					</div>
				</div>
				<div className="flex items-center gap-3">
					{/* <a
						className="hidden text-foreground/70 text-sm hover:text-foreground sm:inline"
						href="/"
					>
						Sign in
					</a> */}
					<a
						className="group inline-flex items-center gap-1.5 border-2 border-foreground bg-[var(--neon-pink)] px-4 py-1.5 text-foreground text-sm tracking-tight shadow-retro-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--foreground)]"
						href="https://github.com/1997roylee/devos.ing"
					>
						Github
						<ArrowUpRight className="h-3.5 w-3.5" />
					</a>
				</div>
			</div>
		</nav>
	);
}
