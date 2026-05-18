import type { ReactElement } from "react";

import type { PixelBotProps } from "@/components/redesign/redesign.types";

export function PixelBot({
	face,
	small,
	variant,
	visor,
}: PixelBotProps): ReactElement {
	const foreground = "var(--foreground)";
	const faceColor = face === "pink" ? "var(--neon-pink)" : "var(--neon-cyan)";
	const visorColor = visor === "pink" ? "var(--neon-pink)" : "var(--neon-cyan)";
	const pixels: Array<[number, number, string]> = [];

	pixels.push([10, 0, foreground], [10, 1, foreground]);
	for (let x = 6; x <= 13; x += 1) {
		pixels.push([x, 2, foreground]);
	}
	pixels.push([5, 3, foreground], [14, 3, foreground]);
	for (let y = 4; y <= 8; y += 1) {
		pixels.push([4, y, foreground], [15, y, foreground]);
	}
	for (let x = 5; x <= 14; x += 1) {
		pixels.push([x, 9, foreground]);
	}
	for (let x = 6; x <= 13; x += 1) {
		pixels.push([x, 3, faceColor]);
	}
	for (let x = 5; x <= 14; x += 1) {
		for (let y = 4; y <= 8; y += 1) {
			pixels.push([x, y, faceColor]);
		}
	}
	for (let x = 5; x <= 14; x += 1) {
		pixels.push([x, 5, foreground]);
	}
	for (let x = 6; x <= 13; x += 1) {
		pixels.push([x, 6, visorColor]);
	}

	for (const pixel of mouthPixels(variant, foreground)) {
		pixels.push(pixel);
	}
	pixels.push(
		[8, 10, foreground],
		[9, 10, foreground],
		[10, 10, foreground],
		[11, 10, foreground],
		[8, 11, foreground],
		[9, 11, foreground],
		[10, 11, foreground],
		[11, 11, foreground],
	);
	for (let x = 3; x <= 16; x += 1) {
		pixels.push([x, 12, foreground], [x, 18, foreground]);
	}
	for (let y = 13; y <= 17; y += 1) {
		pixels.push([3, y, foreground], [16, y, foreground]);
	}
	for (let x = 4; x <= 15; x += 1) {
		for (let y = 13; y <= 17; y += 1) {
			pixels.push([x, y, "var(--card)"]);
		}
	}
	addChestPixels(pixels, variant, foreground);
	pixels.push(
		[2, 13, foreground],
		[2, 14, foreground],
		[2, 15, foreground],
		[17, 13, foreground],
		[17, 14, foreground],
		[17, 15, foreground],
		[5, 19, foreground],
		[6, 19, foreground],
		[13, 19, foreground],
		[14, 19, foreground],
	);
	const uniquePixels = Array.from(
		new Map(pixels.map((pixel) => [pixel.join("-"), pixel])).values(),
	);

	return (
		<svg
			aria-hidden="true"
			className={small ? "h-auto w-[88%]" : "h-auto w-[55%] sm:w-[48%]"}
			shapeRendering="crispEdges"
			viewBox="0 0 20 20"
		>
			{uniquePixels.map(([x, y, color]) => (
				<rect
					fill={color}
					height={1}
					key={`${x}-${y}-${color}`}
					width={1}
					x={x}
					y={y}
				/>
			))}
			<rect className="crew-led" height={1} width={1} x={10} y={1} />
			<g className="crew-blink">
				<rect fill={foreground} height={1} width={1} x={7} y={6} />
				<rect fill={foreground} height={1} width={1} x={12} y={6} />
			</g>
		</svg>
	);
}

function mouthPixels(
	variant: number,
	foreground: string,
): Array<[number, number, string]> {
	return [
		[
			[7, 8, foreground],
			[8, 8, foreground],
			[9, 8, foreground],
			[10, 8, foreground],
			[11, 8, foreground],
			[12, 8, foreground],
		],
		[
			[8, 8, foreground],
			[9, 8, foreground],
			[10, 8, foreground],
			[11, 8, foreground],
		],
		[
			[7, 8, foreground],
			[12, 8, foreground],
			[8, 9, foreground],
			[9, 9, foreground],
			[10, 9, foreground],
			[11, 9, foreground],
		],
		[
			[7, 8, foreground],
			[9, 8, foreground],
			[11, 8, foreground],
			[12, 8, foreground],
		],
		[
			[8, 8, foreground],
			[11, 8, foreground],
		],
	][variant % 5] as Array<[number, number, string]>;
}

function addChestPixels(
	pixels: Array<[number, number, string]>,
	variant: number,
	foreground: string,
): void {
	const stripeColor = variant % 2 ? "var(--neon-cyan)" : "var(--neon-pink)";
	pixels.push([5, 14, stripeColor], [6, 14, stripeColor], [7, 14, stripeColor]);
	pixels.push([5, 15, foreground], [7, 15, foreground]);
	pixels.push([5, 16, stripeColor], [6, 16, stripeColor], [7, 16, stripeColor]);
	for (let x = 9; x <= 14; x += 1) {
		for (let y = 14; y <= 16; y += 1) {
			pixels.push([x, y, foreground]);
		}
	}
	pixels.push(
		[10, 15, stripeColor],
		[12, 15, stripeColor],
		[13, 15, stripeColor],
	);
}
