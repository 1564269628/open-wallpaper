import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { graphql, getRepositoryParts } from "./github-api.mjs";
import { discussionToPost } from "./parser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "data", "posts");
const config = JSON.parse(await readFile(path.join(root, "gallery.config.json"), "utf8"));
const { owner, repo } = getRepositoryParts();
const commentLimit = Math.max(1, Math.min(50, Number(config.commentLimit) || 30));
const replyLimit = Math.max(1, Math.min(20, Number(config.replyLimit) || 5));

const commentFields = `
  id
  bodyText
  url
  createdAt
  updatedAt
  author { login avatarUrl }
`;

const discussionFields = `
  number
  title
  body
  url
  createdAt
  updatedAt
  upvoteCount
  author { login avatarUrl }
  category { name slug }
  labels(first: 50) { nodes { name } }
  comments(last: ${commentLimit}) {
    totalCount
    nodes {
      ${commentFields}
      replies(last: ${replyLimit}) {
        totalCount
        nodes { ${commentFields} }
      }
    }
  }
`;

function isAccepted(discussion) {
  const approved = discussion.labels.nodes.some((label) => label.name === config.approvedLabel);
  const hidden = discussion.labels.nodes.some((label) => label.name === "status:hidden");
  const categoryAccepted =
    config.acceptedCategorySlugs.length === 0 ||
    config.acceptedCategorySlugs.includes(discussion.category.slug);
  return approved && !hidden && categoryAccepted;
}

async function fetchOne(number) {
  const data = await graphql(
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        discussion(number: $number) { ${discussionFields} }
      }
    }`,
    { owner, repo, number }
  );
  return data.repository?.discussion || null;
}

async function fetchAll() {
  const discussions = [];
  let cursor = null;
  do {
    const data = await graphql(
      `query($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          discussions(first: 100, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes { ${discussionFields} }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { owner, repo, cursor }
    );
    const connection = data.repository.discussions;
    discussions.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);
  return discussions;
}

async function writePost(post, directory = postsDir) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${post.discussionNumber}.json`), `${JSON.stringify(post, null, 2)}\n`, "utf8");
}

async function removePost(number) {
  await rm(path.join(postsDir, `${number}.json`), { force: true });
}

async function fullSync() {
  const tempDir = path.join(root, "data", `.posts-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  const discussions = await fetchAll();
  let written = 0;

  for (const discussion of discussions) {
    if (!isAccepted(discussion)) continue;
    const post = discussionToPost(discussion, config);
    if (!post) continue;
    await writePost(post, tempDir);
    written += 1;
  }

  await rm(postsDir, { recursive: true, force: true });
  await rename(tempDir, postsDir);
  console.log(`Full sync complete: ${written}/${discussions.length} discussions published.`);
}

async function incrementalSync(number, deleted) {
  if (deleted) {
    await removePost(number);
    console.log(`Removed discussion #${number}.`);
    return;
  }

  const discussion = await fetchOne(number);
  if (!discussion || !isAccepted(discussion)) {
    await removePost(number);
    console.log(`Discussion #${number} is absent, unapproved, hidden, or outside accepted categories.`);
    return;
  }

  const post = discussionToPost(discussion, config);
  if (!post) {
    await removePost(number);
    console.log(`Discussion #${number} has no allowed GitHub-hosted image.`);
    return;
  }

  await writePost(post);
  console.log(`Updated discussion #${number}.`);
}

const args = new Set(process.argv.slice(2));
if (args.has("--full")) {
  await fullSync();
} else {
  const number = Number(process.env.DISCUSSION_NUMBER || "0");
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error("DISCUSSION_NUMBER must be a positive integer for incremental sync");
  }
  await incrementalSync(number, args.has("--deleted") || process.env.DISCUSSION_DELETED === "true");
}
