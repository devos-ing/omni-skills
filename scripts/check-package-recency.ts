import {
  evaluatePackageRecency,
  formatPackageRecencyResult,
  getPackagePublishDate,
  type NpmPackageMetadata,
  parsePackageSpecifier,
} from "../src/testing/dependency-recency";

const MINIMUM_PACKAGE_AGE_DAYS = 30;
const registryBaseUrl = "https://registry.npmjs.org";
const packageSpecifiers = process.argv.slice(2);

if (packageSpecifiers.length === 0) {
  console.error("Usage: bun scripts/check-package-recency.ts <package[@version]> [...]");
  process.exit(1);
}

let blockedCount = 0;

for (const packageSpecifier of packageSpecifiers) {
  const parsed = parsePackageSpecifier(packageSpecifier);
  const metadata = await fetchPackageMetadata(parsed.name);
  const publishedAt = getPackagePublishDate(metadata, parsed.version);
  const result = evaluatePackageRecency({
    packageName: packageSpecifier,
    publishedAt,
    now: new Date(),
    minimumAgeDays: MINIMUM_PACKAGE_AGE_DAYS,
  });

  const message = formatPackageRecencyResult(result);

  if (result.allowed) {
    console.log(message);
  } else {
    blockedCount += 1;
    console.error(message);
  }
}

if (blockedCount > 0) {
  process.exit(1);
}

async function fetchPackageMetadata(packageName: string): Promise<NpmPackageMetadata> {
  const response = await fetch(`${registryBaseUrl}/${encodeURIComponent(packageName)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch npm metadata for ${packageName}: ${response.status}`);
  }

  return (await response.json()) as NpmPackageMetadata;
}
