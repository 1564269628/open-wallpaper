import { createHash } from "node:crypto";

export function originalImageUrl(image) {
  if (typeof image === "string") return image;
  if (image && typeof image.original === "string") return image.original;
  return "";
}

export function thumbnailKey(originalUrl, length = 12) {
  if (!originalUrl) throw new Error("originalUrl is required");
  return createHash("sha256").update(originalUrl).digest("hex").slice(0, length);
}

export function thumbnailRelativePath(discussionNumber, imageIndex, originalUrl) {
  const number = Number(discussionNumber);
  const index = Number(imageIndex);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error("discussionNumber must be a positive integer");
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("imageIndex must be a non-negative integer");
  }
  return `thumbs/${number}/${index}-${thumbnailKey(originalUrl)}.webp`;
}

export function thumbnailRawUrl(repository, relativePath, branch = "thumbnails") {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository || "")) {
    throw new Error("repository must be in owner/name format");
  }
  const encodedPath = relativePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(branch)}/${encodedPath}`;
}
