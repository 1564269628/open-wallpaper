import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRepositoryParts, graphql, rest } from "./github-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, "gallery.config.json"), "utf8"));
const { owner, repo } = getRepositoryParts();

const labels = [
  [config.approvedLabel, "1f883d", "审核通过，允许在网站公开展示"],
  [config.submissionLabel, "fbca04", "通过壁纸投稿表单创建"],
  ["category:anime", "ff8ab3", "二次元壁纸"],
  ["category:photography", "2188ff", "摄影作品"],
  ["category:illustration", "a371f7", "插画作品"],
  ["category:minimal", "d4c5f9", "极简壁纸"],
  ["category:landscape", "2da44e", "风景壁纸"],
  ["category:other", "8c959f", "其他分类"],
  ["status:hidden", "cf222e", "从网站隐藏"],
  ["content:ai", "8250df", "AI 生成内容"]
];

async function ensureLabels() {
  for (const [name, color, description] of labels) {
    try {
      await rest(`/repos/${owner}/${repo}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, description })
      });
      console.log(`Created label: ${name}`);
    } catch (error) {
      if (error.status !== 422) throw error;
      await rest(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color, description })
      });
      console.log(`Updated label: ${name}`);
    }
  }
}

async function repositoryBootstrapData() {
  const data = await graphql(
    `query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
        discussionCategories(first: 25) { nodes { id name slug } }
        labels(first: 100) { nodes { id name } }
        discussions(first: 100) { nodes { id title number } }
      }
    }`,
    { owner, repo }
  );
  return data.repository;
}

async function createSample(repository, sample) {
  if (repository.discussions.nodes.some((item) => item.title === sample.title)) {
    console.log(`Sample already exists: ${sample.title}`);
    return;
  }

  const category =
    repository.discussionCategories.nodes.find((item) => item.slug === "show-and-tell") ||
    repository.discussionCategories.nodes.find((item) => item.slug === "general") ||
    repository.discussionCategories.nodes[0];
  if (!category) throw new Error("No Discussion category exists. Enable GitHub Discussions first.");

  const created = await graphql(
    `mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
      createDiscussion(input: {
        repositoryId: $repositoryId,
        categoryId: $categoryId,
        title: $title,
        body: $body
      }) { discussion { id number title } }
    }`,
    {
      repositoryId: repository.id,
      categoryId: category.id,
      title: sample.title,
      body: sample.body
    }
  );

  const labelIds = sample.labels
    .map((name) => repository.labels.nodes.find((label) => label.name === name)?.id)
    .filter(Boolean);
  if (labelIds.length) {
    await graphql(
      `mutation($labelableId: ID!, $labelIds: [ID!]!) {
        addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
          labelable { ... on Discussion { number } }
        }
      }`,
      { labelableId: created.createDiscussion.discussion.id, labelIds }
    );
  }
  console.log(`Created sample discussion #${created.createDiscussion.discussion.number}`);
}

await ensureLabels();
const repository = await repositoryBootstrapData();
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/main/site/assets`;

await createSample(repository, {
  title: "[示例] 月光与远山",
  labels: [config.approvedLabel, config.submissionLabel, "category:landscape"],
  body: `### 图片\n\n![月光与远山](${rawBase}/demo-landscape.svg)\n\n### 分类\n\n风景\n\n### 描述\n\n用于验证 Discussion → Action → GitHub Pages 全链路的示例壁纸。\n\n### 来源或作者\n\nOpen Wallpaper 内置示例\n\n### 内容声明\n\n- [x] 我拥有发布该图片的权利，或该图片允许公开分享。`
});

await createSample(repository, {
  title: "[示例] 霓虹少女",
  labels: [config.approvedLabel, config.submissionLabel, "category:anime", "content:ai"],
  body: `### 图片\n\n![霓虹少女](${rawBase}/demo-anime.svg)\n\n### 分类\n\n二次元\n\n### 描述\n\n用于测试分类、标签、瀑布流预览和详情弹窗的示例壁纸。\n\n### 来源或作者\n\nOpen Wallpaper 内置示例\n\n### 内容声明\n\n- [x] 我拥有发布该图片的权利，或该图片允许公开分享。`
});
