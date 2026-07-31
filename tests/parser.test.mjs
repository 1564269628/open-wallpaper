import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryFromDiscussion,
  cleanDescription,
  discussionToPost,
  extractImageUrls,
  isAllowedImageUrl,
  parseDiscussionForm
} from "../scripts/parser.mjs";

const config = {
  approvedLabel: "approved",
  submissionLabel: "submission",
  categoryLabelPrefix: "category:",
  allowedImageHosts: ["github.com", "raw.githubusercontent.com", "githubusercontent.com"],
  maxImagesPerDiscussion: 12
};

test("allows GitHub attachment URLs and rejects arbitrary hosts", () => {
  assert.equal(
    isAllowedImageUrl("https://github.com/user-attachments/assets/abc-def", config.allowedImageHosts),
    true
  );
  assert.equal(isAllowedImageUrl("https://example.com/wallpaper.jpg", config.allowedImageHosts), false);
  assert.equal(isAllowedImageUrl("http://github.com/user-attachments/assets/abc", config.allowedImageHosts), false);
});

test("extracts and de-duplicates Markdown and HTML images", () => {
  const body = `![one](https://github.com/user-attachments/assets/a-b)\n<img src="https://raw.githubusercontent.com/o/r/main/a.png">\n![again](https://github.com/user-attachments/assets/a-b)`;
  assert.deepEqual(extractImageUrls(body, config.allowedImageHosts), [
    "https://github.com/user-attachments/assets/a-b",
    "https://raw.githubusercontent.com/o/r/main/a.png"
  ]);
});

test("parses Discussion form headings", () => {
  const parsed = parseDiscussionForm("### 分类\n\n二次元\n\n### 描述\n\n安静的夜晚");
  assert.equal(parsed["分类"], "二次元");
  assert.equal(parsed["描述"], "安静的夜晚");
});

test("uses category labels before form values", () => {
  const discussion = {
    body: "### 分类\n\n风景",
    labels: { nodes: [{ name: "category:anime" }] }
  };
  assert.equal(categoryFromDiscussion(discussion, "category:"), "anime");
});

test("converts a discussion into a safe post object", () => {
  const post = discussionToPost(
    {
      number: 12,
      title: "测试壁纸",
      body: "### 图片\n\n![wallpaper](https://github.com/user-attachments/assets/a-b)\n\n### 描述\n\n**漂亮** 的壁纸",
      url: "https://github.com/o/r/discussions/12",
      createdAt: "2026-07-30T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
      upvoteCount: 3,
      author: { login: "alice", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
      category: { name: "Show and tell", slug: "show-and-tell" },
      labels: { nodes: [{ name: "approved" }, { name: "category:anime" }] },
      comments: { totalCount: 2 }
    },
    config
  );
  assert.equal(post.title, "测试壁纸");
  assert.equal(post.category, "anime");
  assert.equal(post.commentCount, 2);
  assert.equal(post.description, "**漂亮** 的壁纸");
});

test("cleanDescription removes images and HTML", () => {
  assert.equal(cleanDescription("![x](https://x/y.png) <b>Hello</b>   world"), "Hello world");
});
