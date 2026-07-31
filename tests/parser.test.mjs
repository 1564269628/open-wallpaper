import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryFromDiscussion,
  cleanDescription,
  commentToData,
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

test("maps comments and nested replies into safe plain text data", () => {
  const mapped = commentToData({
    id: "DC_1",
    bodyText: "hello\r\nworld",
    url: "https://github.com/o/r/discussions/1#discussioncomment-1",
    createdAt: "2026-07-31T00:00:00Z",
    updatedAt: "2026-07-31T00:00:00Z",
    author: { login: "bob", avatarUrl: "https://avatars.githubusercontent.com/u/2" },
    replies: {
      totalCount: 1,
      nodes: [{
        id: "DC_2",
        bodyText: "reply",
        createdAt: "2026-07-31T01:00:00Z",
        updatedAt: "2026-07-31T01:00:00Z",
        author: { login: "alice", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
        replies: { totalCount: 0, nodes: [] }
      }]
    }
  });
  assert.equal(mapped.author, "bob");
  assert.equal(mapped.body, "hello\nworld");
  assert.equal(mapped.replyCount, 1);
  assert.equal(mapped.replies[0].author, "alice");
});

test("converts a discussion into a post with comments", () => {
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
      comments: {
        totalCount: 2,
        nodes: [{
          id: "DC_1",
          bodyText: "好看",
          createdAt: "2026-07-31T01:00:00Z",
          updatedAt: "2026-07-31T01:00:00Z",
          author: { login: "bob", avatarUrl: "" },
          replies: { totalCount: 0, nodes: [] }
        }]
      }
    },
    config
  );
  assert.equal(post.title, "测试壁纸");
  assert.equal(post.category, "anime");
  assert.equal(post.commentCount, 2);
  assert.equal(post.comments[0].body, "好看");
  assert.equal(post.description, "**漂亮** 的壁纸");
});

test("cleanDescription removes images and HTML", () => {
  assert.equal(cleanDescription("![x](https://x/y.png) <b>Hello</b>   world"), "Hello world");
});
