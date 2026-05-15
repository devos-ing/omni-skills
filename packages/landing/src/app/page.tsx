import type { ReactElement } from "react";

import { LandingFooter } from "@/components/landing-footer";
import { LandingHeader } from "@/components/landing-header";
import {
	FaqSection,
	FeatureSection,
	HeroSection,
	HowItWorksSection,
	RunCommandSection,
} from "@/components/landing-sections";

export default function HomePage(): ReactElement {
	return (
		<main className="grain min-h-screen overflow-hidden">
			<LandingHeader />
			<HeroSection />
			<RunCommandSection />
			<HowItWorksSection />
			<FeatureSection />
			<FaqSection />
			<LandingFooter />
		</main>
	);
}
