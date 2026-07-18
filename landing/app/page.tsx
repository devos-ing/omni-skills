import { LandingPage } from "../components/landing-page";
import { formatGithubStarsLabel } from "../lib/github-stars";

const githubRepositoryApiUrl = "https://api.github.com/repos/devos-ing/omni-skills";
const githubStarsFallbackLabel = "Stars";

interface GitHubRepositoryMetadata {
  stargazers_count?: unknown;
}

async function fetchGithubStarsLabel(): Promise<string> {
  try {
    const response = await fetch(githubRepositoryApiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return githubStarsFallbackLabel;

    const metadata = (await response.json()) as GitHubRepositoryMetadata;
    if (typeof metadata.stargazers_count !== "number") return githubStarsFallbackLabel;

    return formatGithubStarsLabel(metadata.stargazers_count);
  } catch {
    return githubStarsFallbackLabel;
  }
}

export default async function Page() {
  const githubStarsLabel = await fetchGithubStarsLabel();

  return <LandingPage githubStarsLabel={githubStarsLabel} />;
}
