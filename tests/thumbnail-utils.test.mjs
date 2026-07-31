import test from "node:test";
import assert from "node:assert/strict";
import {
  originalImageUrl,
  thumbnailKey,
  thumbnailRawUrl,
  thumbnailRelativePath
} from "../scripts/thumbnail-utils.mjs";

test("normalizes string and object image records", () => {
  const first = "https://github.com/user-attachments/assets/a-b";
  const second = "https://github.com/user-attachments/assets/c-d";
  assert.equal(originalImageUrl(first), first);
  assert.equal(originalImageUrl({ original: second }), second);
  assert.equal(originalImageUrl(null), "");
});

test("creates stable content-addressed thumbnail paths", () => {
  const url = "https://github.com/user-attachments/assets/a-b";
  const first = thumbnailRelativePath(3, 0, url);
  const second = thumbnailRelativePath(3, 0, url);
  assert.equal(first, second);
  assert.match(first, /^thumbs\/3\/0-[a-f0-9]{12}\.webp$/);
  assert.equal(thumbnailKey(url).length, 12);
});

test("builds raw GitHub URLs for the thumbnail branch", () => {
  assert.equal(
    thumbnailRawUrl("owner/repo", "thumbs/3/0-a.webp", "thumbnails"),
    "https://raw.githubusercontent.com/owner/repo/thumbnails/thumbs/3/0-a.webp"
  );
});
