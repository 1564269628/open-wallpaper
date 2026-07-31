import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  originalImageUrl,
  thumbnailRawUrl,
  thumbnailRelativePath
} from "./thumbnail-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "data", "posts");
const config = JSON.parse(await readFile(path.join(root, "gallery.config.json"), "utf8"));
const outputDir = path.resolve(process.env.THUMBNAIL_DIR || process.argv[2] || path.join(root, ".thumbnail-store"));
const repository = process.env.GITHUB_REPOSITORY || "1564269628/open-wallpaper";
const branch = config.thumbnailBranch || "thumbnails";
const width = Math.max(240, Math.min(1600, Number(config.thumbnailWidth) || 640));
const quality = Math.max(30, Math.min(95, Number(config.thumbnailQuality) || 74));
const maxSourceBytes = Math.max(1024 * 1024, Number(config.thumbnailMaxSourceBytes) || 40 * 1024 * 1024);
const expectedFiles = new Set();
const manifest = [];

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "open-wallpaper-thumbnail-builder"
      }
    });
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const announcedLength = Number(response.headers.get("content-length") || "0");
    if (announcedLength > maxSourceBytes) {
      throw new Error(`source image exceeds ${maxSourceBytes} bytes`);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxSourceBytes) {
        await reader.cancel();
        throw new Error(`source image exceeds ${maxSourceBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timeout);
  }
}

async function createThumbnail(originalUrl, targetFile) {
  const source = await downloadImage(originalUrl);
  await mkdir(path.dirname(targetFile), { recursive: true });
  return sharp(source, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 120_000_000
  })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4, smartSubsample: true })
    .toFile(targetFile);
}

async function thumbnailInfo(targetFile) {
  const metadata = await sharp(targetFile).metadata();
  const file = await stat(targetFile);
  return {
    width: metadata.width || null,
    height: metadata.height || null,
    bytes: file.size
  };
}

async function removeUnexpectedFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeUnexpectedFiles(filename);
      if ((await readdir(filename).catch(() => [])).length === 0) {
        await rm(filename, { recursive: true, force: true });
      }
      continue;
    }
    const relative = path.relative(outputDir, filename).split(path.sep).join("/");
    if (!expectedFiles.has(relative)) await rm(filename, { force: true });
  }
}

await mkdir(outputDir, { recursive: true });
const postFiles = (await readdir(postsDir).catch(() => []))
  .filter((filename) => filename.endsWith(".json"))
  .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

let generated = 0;
let reused = 0;
let failed = 0;

for (const filename of postFiles) {
  const postPath = path.join(postsDir, filename);
  const originalText = await readFile(postPath, "utf8");
  const post = JSON.parse(originalText);
  const originals = (post.images || []).map(originalImageUrl).filter(Boolean);
  const images = [];

  for (const [index, original] of originals.entries()) {
    const relativePath = thumbnailRelativePath(post.discussionNumber, index, original);
    const targetFile = path.join(outputDir, ...relativePath.split("/"));
    expectedFiles.add(relativePath);

    try {
      if (await exists(targetFile)) {
        reused += 1;
      } else {
        await createThumbnail(original, targetFile);
        generated += 1;
      }
      const info = await thumbnailInfo(targetFile);
      const thumbnail = thumbnailRawUrl(repository, relativePath, branch);
      images.push({ original, thumbnail, ...info });
      manifest.push({ discussionNumber: post.discussionNumber, index, original, thumbnail, relativePath, ...info });
    } catch (error) {
      failed += 1;
      console.warn(`Thumbnail failed for discussion #${post.discussionNumber}, image ${index + 1}: ${error.message}`);
      images.push({ original, thumbnail: original, width: null, height: null, bytes: null });
    }
  }

  post.images = images;
  post.coverImage = images[0]?.original || post.coverImage || "";
  post.coverThumbnail = images[0]?.thumbnail || post.coverImage;
  post.thumbnailBranch = branch;
  post.thumbnailVersion = 1;

  const nextText = `${JSON.stringify(post, null, 2)}\n`;
  if (nextText !== originalText) await writeFile(postPath, nextText, "utf8");
}

await removeUnexpectedFiles(path.join(outputDir, "thumbs"));
expectedFiles.add("README.md");
expectedFiles.add("manifest.json");

await writeFile(
  path.join(outputDir, "README.md"),
  `# Open Wallpaper thumbnails\n\nThis orphan branch is an automatically generated snapshot. Do not edit files manually.\n\n- Width: ${width}px maximum\n- Format: WebP\n- Quality: ${quality}\n- Source: GitHub Discussion attachments\n`,
  "utf8"
);
await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), repository, branch, count: manifest.length, images: manifest }, null, 2)}\n`,
  "utf8"
);

console.log(`Thumbnail snapshot ready: ${manifest.length} images, ${generated} generated, ${reused} reused, ${failed} fallback(s).`);
