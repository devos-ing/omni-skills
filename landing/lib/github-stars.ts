export function formatGithubStarsLabel(stars: number): string {
  if (stars >= 1000) {
    const compact = new Intl.NumberFormat("en", {
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(stars);

    return `${compact.toLowerCase()} stars`;
  }

  return `${stars.toLocaleString("en")} stars`;
}
