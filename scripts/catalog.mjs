import fs from "node:fs";
import path from "node:path";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_PATTERN = /^(?:[a-z0-9.-]+\/)+[a-z0-9._/-]+(?::[A-Za-z0-9._-]+|@sha256:[0-9a-f]{64})$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLATFORM_PATTERN = /^linux\/(?:amd64|arm64|arm\/v[67]|386|ppc64le|s390x|riscv64)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BUILD_ARG_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const BUILD_ARG_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+:/@-]*$/;

export function loadCatalog(file = "catalog/images.json") {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
  }
}

function buildConfiguration(image) {
  const build = image.build ?? {};
  const args = build.args ?? {};
  const patches = build.patches ?? [];

  return {
    buildArgs: Object.entries(args)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}=${value}`)
      .join("\n"),
    hasPatches: patches.length > 0,
    modifiedBuild: Object.keys(args).length > 0 || patches.length > 0,
    patches: JSON.stringify(patches)
  };
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

    const build = image.build ?? {};
    if (build.args !== undefined) {
      if (
        typeof build.args !== "object" ||
        build.args === null ||
        Array.isArray(build.args)
      ) {
        errors.push(`${prefix}.build.args must be an object`);
      } else {
        for (const [name, value] of Object.entries(build.args)) {
          if (!BUILD_ARG_PATTERN.test(name)) {
            errors.push(`${prefix}.build.args contains invalid argument name ${name}`);
          }
          requireString(value, `${prefix}.build.args.${name}`, errors);
          if (typeof value === "string" && !BUILD_ARG_VALUE_PATTERN.test(value)) {
            errors.push(`${prefix}.build.args.${name} contains unsupported characters`);
          }
        }
      }
    }
    if (build.patches !== undefined) {
      if (!Array.isArray(build.patches)) {
        errors.push(`${prefix}.build.patches must be an array`);
      } else {
        const patchPaths = new Set();
        for (const [patchIndex, patch] of build.patches.entries()) {
          const field = `${prefix}.build.patches[${patchIndex}]`;
          requireString(patch, field, errors);
          if (
            typeof patch === "string" &&
            (!patch.startsWith(`patches/${image.name}/`) ||
              path.isAbsolute(patch) ||
              patch.split("/").includes("..") ||
              !patch.endsWith(".patch") ||
              !fs.existsSync(path.join(root, patch)))
          ) {
            errors.push(
              `${field} must reference an existing .patch file under patches/${image.name}/`
            );
          }
          if (patchPaths.has(patch)) {
            errors.push(`${field} duplicates ${patch}`);
          }
          patchPaths.add(patch);
        }
      }
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

    const release = image.release ?? {};
    if (typeof release.enabled !== "boolean") {
      errors.push(`${prefix}.release.enabled must be a boolean`);
    }
    if (
      release.enabled === false &&
      (typeof release.blockedReason !== "string" || release.blockedReason.trim() === "")
    ) {
      errors.push(`${prefix}.release.blockedReason must explain why publication is disabled`);
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
    if (typeof policy.reviewedAt !== "string" || !DATE_PATTERN.test(policy.reviewedAt)) {
      errors.push(`${prefix}.policy.reviewedAt must be an ISO 8601 date`);
    }
    if (
      typeof policy.evidence !== "string" ||
      !policy.evidence.startsWith("https://github.com/")
    ) {
      errors.push(`${prefix}.policy.evidence must be a GitHub evidence URL`);
    }
  }

  return errors;
}

export function verificationMatrix(catalog, releaseEnabledOnly = false) {
  const images = releaseEnabledOnly
    ? catalog.images.filter((image) => image.release.enabled)
    : catalog.images;
  return {
    include: images.flatMap((image) =>
      image.platforms.map((platform) => {
        const build = buildConfiguration(image);
        return {
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
          buildArgs: build.buildArgs,
          hasPatches: build.hasPatches,
          modifiedBuild: build.modifiedBuild,
          patches: build.patches,
          testScript: image.test.script,
          timeoutSeconds: image.test.timeoutSeconds,
          maxFixableHighCritical: image.policy.maxFixableHighCritical,
          requireNoRegression: image.policy.requireNoRegression
        };
      })
    )
  };
}

export function publicationMatrix(catalog) {
  return {
    include: catalog.images.filter((image) => image.release.enabled).map((image) => {
      const build = buildConfiguration(image);
      return {
        name: image.name,
        description: image.description,
        sourceRepository: image.upstream.sourceRepository,
        sourceTag: image.upstream.sourceTag,
        sourceCommit: image.upstream.sourceCommit,
        version: image.upstream.version,
        license: image.upstream.license,
        context: image.upstream.context,
        dockerfile: image.upstream.dockerfile,
        buildArgs: build.buildArgs,
        hasPatches: build.hasPatches,
        modifiedBuild: build.modifiedBuild,
        patches: build.patches,
        outputImage: image.output.image,
        platforms: image.platforms.join(","),
        maxFixableHighCritical: image.policy.maxFixableHighCritical
      };
    })
  };
}
