import type { ReactElement } from "react";

import { HeroVisual } from "@/components/hero-visual";
import type { SectionIntroProps } from "@/components/landing-sections.types";
import { RunCommandCopyButton } from "@/components/run-command-copy-button";
import {
	faqs,
	features,
	readmeUrl,
	repositoryUrl,
	runCommand,
	workflowFlow,
} from "@/lib/landing-content";

export function HeroSection(): ReactElement {
	return (
		<section className="relative border-b-2 border-ink bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
			<div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.86fr_1.14fr]">
				<div className="reveal">
					<p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-copper">
						Agentic development hub
					</p>
					<h1 className="mt-8 max-w-4xl font-display text-6xl leading-[0.9] sm:text-7xl lg:text-8xl">
						devos.ing
					</h1>
					<p className="mt-8 max-w-2xl text-balance font-display text-3xl leading-tight sm:text-4xl">
						Talk is cheap, show me your agent system.
					</p>
					<p className="mt-7 max-w-lg text-lg leading-8 text-ink/72">
						Turn Linear issues into controlled agent runs from plan to review.
					</p>
					<div className="mt-10 flex flex-col gap-3 sm:flex-row">
						<a
							className="border-2 border-ink bg-circuit px-5 py-4 text-center font-mono text-xs font-black uppercase tracking-[0.18em] shadow-[6px_6px_0_#10110d] transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#10110d]"
							href={repositoryUrl}
						>
							View repo
						</a>
						<a
							className="border-2 border-ink bg-bone px-5 py-4 text-center font-mono text-xs font-black uppercase tracking-[0.18em] transition hover:bg-ink hover:text-bone"
							href={readmeUrl}
						>
							Read docs
						</a>
					</div>
				</div>
				<div className="reveal hidden [animation-delay:140ms] md:block">
					<HeroVisual />
				</div>
			</div>
		</section>
	);
}

export function RunCommandSection(): ReactElement {
	return (
		<section
			className="border-b-2 border-ink bg-paper px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
			id="start"
		>
			<div className="reveal mx-auto flex max-w-4xl flex-col items-center text-center">
				<p className="rounded-full border-2 border-ink bg-bone px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.2em]">
					{runCommand.kicker}
				</p>
				<h2 className="mt-8 max-w-3xl text-balance font-display text-5xl leading-none sm:text-6xl">
					{runCommand.title}
				</h2>
				<p className="mt-6 max-w-2xl text-lg leading-8 text-ink/64">
					{runCommand.body}
				</p>
				<div className="mt-10 w-full max-w-2xl overflow-hidden border-2 border-ink bg-ink text-white shadow-[8px_8px_0_#b7ff4a]">
					<div className="flex items-center justify-between border-b-2 border-white/12 bg-white/6 px-4 py-3">
						<div className="flex items-center gap-2" aria-hidden="true">
							<span className="h-3 w-3 rounded-full bg-white/18" />
							<span className="h-3 w-3 rounded-full bg-white/18" />
							<span className="h-3 w-3 rounded-full bg-circuit" />
						</div>
						<p className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
							setup
						</p>
					</div>
					<div className="flex flex-col gap-4 px-5 py-6 text-left sm:flex-row sm:items-center sm:justify-between">
						<p className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-lg leading-8 text-white sm:text-xl">
							<span className="text-circuit">$</span> {runCommand.command}
						</p>
						<RunCommandCopyButton command={runCommand.command} />
					</div>
				</div>
			</div>
		</section>
	);
}

export function HowItWorksSection(): ReactElement {
	return (
		<section
			className="border-b-2 border-ink bg-bone px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
			id="how"
		>
			<div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
				<SectionIntro
					kicker="How this works"
					title="One calm loop from issue to reviewed code."
				/>
				<div
					aria-label="Agent workflow from project board through testing loop"
					className="reveal [animation-delay:120ms]"
				>
					<ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{workflowFlow.map((step, index) => (
							<li
								className="flow-node relative flex min-h-36 flex-col justify-between border-2 border-ink bg-paper p-5"
								key={step}
							>
								<p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-copper">
									0{index + 1}
								</p>
								<h3 className="mt-10 font-display text-3xl font-black leading-none">
									{step}
								</h3>
							</li>
						))}
					</ol>
				</div>
			</div>
		</section>
	);
}

export function FeatureSection(): ReactElement {
	return (
		<section
			className="border-b-2 border-ink bg-ink px-4 py-24 text-bone sm:px-6 lg:px-8 lg:py-32"
			id="features"
		>
			<div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.7fr_1.3fr]">
				<SectionIntro
					kicker="Features"
					title="Built for repeatable agent work."
					inverted
				/>
				<div className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
					{features.map((feature) => (
						<article
							className="border-t-2 border-bone/25 pt-5"
							key={feature.title}
						>
							<h3 className="font-display text-3xl leading-tight text-circuit sm:text-4xl">
								{feature.title}
							</h3>
							<p className="mt-4 max-w-sm leading-7 text-bone/72">
								{feature.body}
							</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}

export function FaqSection(): ReactElement {
	return (
		<section className="bg-paper px-4 py-24 sm:px-6 lg:px-8 lg:py-32" id="faq">
			<div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr]">
				<SectionIntro kicker="FAQ" title="Short answers." />
				<div className="grid gap-4">
					{faqs.map((faq) => (
						<details
							className="group border-2 border-ink bg-bone p-6"
							key={faq.question}
						>
							<summary className="cursor-pointer list-none font-display text-2xl leading-tight sm:text-3xl">
								<span>{faq.question}</span>
								<span className="float-right font-mono text-copper group-open:rotate-45">
									+
								</span>
							</summary>
							<p className="mt-5 max-w-2xl leading-7 text-ink/72">
								{faq.answer}
							</p>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}

function SectionIntro({
	inverted = false,
	kicker,
	title,
}: SectionIntroProps): ReactElement {
	return (
		<div className="max-w-2xl">
			<p
				className={`font-mono text-xs font-black uppercase tracking-[0.24em] ${
					inverted ? "text-circuit" : "text-copper"
				}`}
			>
				{kicker}
			</p>
			<h2 className="mt-5 text-balance font-display text-5xl leading-none sm:text-6xl">
				{title}
			</h2>
		</div>
	);
}
