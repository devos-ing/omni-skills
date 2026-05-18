import type { ReactElement } from "react";

const logos = [
	"Linear",
	"Vercel",
	"Ramp",
	"Notion",
	"Anthropic",
	"Supabase",
	"Stripe",
];
const marqueeLogos = ["a", "b", "c"].flatMap((round) =>
	logos.map((logo) => ({ id: `${round}-${logo}`, logo })),
);

export function Logos(): ReactElement {
	return (
		<section className="overflow-hidden border-foreground border-b-2 bg-foreground py-4 text-background">
			<div className="flex animate-[ticker_30s_linear_infinite] items-center gap-12 whitespace-nowrap">
				{marqueeLogos.map((item) => (
					<span
						className="flex items-center gap-12 font-pixel text-2xl tracking-widest"
						key={item.id}
					>
						<span className="text-[var(--neon-cyan)]">{"\u2605"}</span>{" "}
						{item.logo}
					</span>
				))}
			</div>
		</section>
	);
}
