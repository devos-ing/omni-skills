export interface PackageSpecifier {
  name: string;
  version?: string;
}

export interface NpmPackageMetadata {
  "dist-tags"?: {
    latest?: string;
  };
  time?: Record<string, string>;
}

export interface PackageRecencyInput {
  packageName: string;
  publishedAt: Date;
  now: Date;
  minimumAgeDays: number;
}

export interface PackageRecencyResult {
  packageName: string;
  allowed: boolean;
  ageDays: number;
  minimumAgeDays: number;
  publishedAt: Date;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function parsePackageSpecifier(specifier: string): PackageSpecifier {
  const trimmed = specifier.trim();

  if (!trimmed) {
    throw new Error("Package specifier cannot be empty");
  }

  if (trimmed.startsWith("@")) {
    const versionSeparatorIndex = trimmed.indexOf("@", 1);

    if (versionSeparatorIndex === -1) {
      return { name: trimmed };
    }

    return {
      name: trimmed.slice(0, versionSeparatorIndex),
      version: trimmed.slice(versionSeparatorIndex + 1),
    };
  }

  const versionSeparatorIndex = trimmed.indexOf("@");

  if (versionSeparatorIndex === -1) {
    return { name: trimmed };
  }

  return {
    name: trimmed.slice(0, versionSeparatorIndex),
    version: trimmed.slice(versionSeparatorIndex + 1),
  };
}

export function getPackagePublishDate(metadata: NpmPackageMetadata, version?: string): Date {
  const selectedVersion = version ?? metadata["dist-tags"]?.latest;

  if (!selectedVersion) {
    throw new Error("Package metadata does not include a latest version");
  }

  const publishedAt = metadata.time?.[selectedVersion];

  if (!publishedAt) {
    throw new Error(`Package metadata does not include publish time for ${selectedVersion}`);
  }

  const publishedDate = new Date(publishedAt);

  if (Number.isNaN(publishedDate.getTime())) {
    throw new Error(`Package metadata has an invalid publish date for ${selectedVersion}`);
  }

  return publishedDate;
}

export function evaluatePackageRecency(input: PackageRecencyInput): PackageRecencyResult {
  const ageDays = Math.floor(
    (input.now.getTime() - input.publishedAt.getTime()) / MILLISECONDS_PER_DAY,
  );

  return {
    packageName: input.packageName,
    allowed: ageDays >= input.minimumAgeDays,
    ageDays,
    minimumAgeDays: input.minimumAgeDays,
    publishedAt: input.publishedAt,
  };
}

export function formatPackageRecencyResult(result: PackageRecencyResult): string {
  const status = result.allowed ? "allowed" : "blocked";

  return `${result.packageName} ${status}: published ${result.publishedAt.toISOString()} (${result.ageDays} days old, minimum is ${result.minimumAgeDays} days).`;
}
