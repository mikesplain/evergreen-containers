import fs from "node:fs";
import path from "node:path";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_PATTERN = /^(?:[a-z0-9.-]+\/)+[a-z0-9._/-]+(?::[A-Za-z0-9._-]+|@sha256:[0-9a-f]{64})$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLATFORM_PATTERN = /^linux\/(?:amd64|arm64|arm\/v[67]|386|ppc64le|s390x|riscv64)$/;

export function loadCatalog(file = "catalog/images.json") {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
  }
}

export function validateCatalog(catalog, root = process.cwd()) {
  const errors = [];

  if (catalog?.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (!Array.isArray(catalog?.images) || catalog.images.length === 0) {
    errors.push("images must be a non-empty array");
    return errors;
  }

  const names = new Set();
  const outputs = new Set();

  for (const [index, image] of catalog.images.entries()) {
    const prefix = `images[${index}]`;
    requireString(image.name, `${prefix}.name`, errors);
    requireString(image.description, `${prefix}.description`, errors);

    if (typeof image.name === "string") {
      if (!NAME_PATTERN.test(image.name)) {
        errors.push(`${prefix}.name must be lowercase kebab-case`);
      }
      if (names.has(image.name)) {
        errors.push(`${prefix}.name duplicates ${image.name}`);
      }
      names.add(image.name);
    }

    if (image.mode !== "source-rebuild") {
      errors.push(`${prefix}.mode must be source-rebuild`);
    }

    const upstream = image.upstream ?? {};
    requireString(upstream.image, `${prefix}.upstream.image`, errors);
    requireString(upstream.sourceRepository, `${prefix}.upstream.sourceRepository`, errors);
    requireString(upstream.sourceTag, `${prefix}.upstream.sourceTag`, errors);
    requireString(upstream.sourceCommit, `${prefix}.upstream.sourceCommit`, errors);
    requireString(upstream.version, `${prefix}.upstream.version`, errors);
    requireString(upstream.license, `${prefix}.upstream.license`, errors);
    requireString(upstream.context, `${prefix}.upstream.context`, errors);
    requireString(upstream.dockerfile, `${prefix}.upstream.dockerfile`, errors);

    if (typeof upstream.image === "string" && !IMAGE_PATTERN.test(upstream.image)) {
      errors.push(`${prefix}.upstream.image must be a qualified tagged or digest-pinned image`);
    }
    if (
      typeof upstream.sourceRepository === "string" &&
      !REPOSITORY_PATTERN.test(upstream.sourceRepository)
    ) {
      errors.push(`${prefix}.upstream.sourceRepository must be owner/repository`);
    }
    if (typeof upstream.sourceCommit === "string" && !SHA_PATTERN.test(upstream.sourceCommit)) {
      errors.push(`${prefix}.upstream.sourceCommit must be a full 40-character commit SHA`);
    }
    if (typeof upstream.sourceTag === "string" && !TAG_PATTERN.test(upstream.sourceTag)) {
      errors.push(`${prefix}.upstream.sourceTag contains unsupported characters`);
    }

    const output = image.output ?? {};
    requireString(output.image, `${prefix}.output.image`, errors);
    if (typeof output.image === "string") {
      if (!IMAGE_PATTERN.test(`${output.image}:candidate`)) {
        errors.push(`${prefix}.output.image must be a qualified image repository without a tag`);
      }
      if (outputs.has(output.image)) {
        errors.push(`${prefix}.output.image duplicates ${output.image}`);
      }
      outputs.add(output.image);
    }

    if (!Array.isArray(image.platforms) || image.platforms.length === 0) {
      errors.push(`${prefix}.platforms must be a non-empty array`);
    } else {
      const platforms = new Set();
      for (const platform of image.platforms) {
        if (typeof platform !== "string" || !PLATFORM_PATTERN.test(platform)) {
          errors.push(`${prefix}.platforms contains unsupported platform ${platform}`);
        }
        if (platforms.has(platform)) {
          errors.push(`${prefix}.platforms contains duplicate ${platform}`);
        }
        platforms.add(platform);
      }
    }

    const test = image.test ?? {};
    requireString(test.script, `${prefix}.test.script`, errors);
    if (
      typeof test.script === "string" &&
      (!test.script.startsWith("tests/") ||
        path.isAbsolute(test.script) ||
        !fs.existsSync(path.join(root, test.script)))
    ) {
      errors.push(`${prefix}.test.script must reference an existing file under tests/`);
    }
    if (!Number.isInteger(test.timeoutSeconds) || test.timeoutSeconds < 30) {
      errors.push(`${prefix}.test.timeoutSeconds must be an integer of at least 30`);
    }

    const policy = image.policy ?? {};
    if (
      !Number.isInteger(policy.maxFixableHighCritical) ||
      policy.maxFixableHighCritical < 0
    ) {
      errors.push(`${prefix}.policy.maxFixableHighCritical must be a non-negative integer`);
    }
    if (typeof policy.requireNoRegression !== "boolean") {
      errors.push(`${prefix}.policy.requireNoRegression must be a boolean`);
    }
  }

  return errors;
}

export function verificationMatrix(catalog) {
  return {
    include: catalog.images.flatMap((image) =>
      image.platforms.map((platform) => ({
        name: image.name,
        platform,
        platformSlug: platform.replaceAll("/", "-"),
        runner: platform === "linux/arm64" ? "ubuntu-24.04-arm" : "ubuntu-24.04",
        upstreamImage: image.upstream.image,
        sourceRepository: image.upstream.sourceRepository,
        sourceTag: image.upstream.sourceTag,
        sourceCommit: image.upstream.sourceCommit,
        context: image.upstream.context,
        dockerfile: image.upstream.dockerfile,
        testScript: image.test.script,
        timeoutSeconds: image.test.timeoutSeconds,
        maxFixableHighCritical: image.policy.maxFixableHighCritical,
        requireNoRegression: image.policy.requireNoRegression
      }))
    )
  };
}

export function publicationMatrix(catalog) {
  return {
    include: catalog.images.map((image) => ({
      name: image.name,
      description: image.description,
      sourceRepository: image.upstream.sourceRepository,
      sourceTag: image.upstream.sourceTag,
      sourceCommit: image.upstream.sourceCommit,
      version: image.upstream.version,
      license: image.upstream.license,
      context: image.upstream.context,
      dockerfile: image.upstream.dockerfile,
      outputImage: image.output.image,
      platforms: image.platforms.join(",")
    }))
  };
}
