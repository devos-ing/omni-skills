import type { ReactElement } from "react";

import { AgentsCrew } from "@/components/redesign/agents-crew";
import { CTA } from "@/components/redesign/cta";
import { Features } from "@/components/redesign/features";
import { Flow } from "@/components/redesign/flow";
import { Footer } from "@/components/redesign/footer";
import { Hero } from "@/components/redesign/hero";
import { Logos } from "@/components/redesign/logos";
import { Metrics } from "@/components/redesign/metrics";
import { Nav } from "@/components/redesign/nav";
import { Onboard } from "@/components/redesign/onboard";
import { ProjectBoard } from "@/components/redesign/project-board";
import { SkillsTree } from "@/components/redesign/skills-tree";
import { Telegram } from "@/components/redesign/telegram";

export function RedesignLandingPage(): ReactElement {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Nav />
			<main>
				<Hero />
				<Logos />
				<Onboard />
				<Flow />
				<AgentsCrew />
				<ProjectBoard />
				<Telegram />
				<Features />
				<SkillsTree />
				{/* <Metrics /> */}
				<CTA />
			</main>
			<Footer />
		</div>
	);
}
