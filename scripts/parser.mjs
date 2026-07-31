const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

export function normalizeHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isAllowedImageUrl(rawUrl, allowedHosts = []) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;

    const host = normalizeHost(url.hostname);
    const hostAllowed = allowedHosts.some((allowed) => {
      const normalized = normalizeHost(allowed);
      return host === normalized || host.endsWith(`.${normalized}`);
    });
    if (!hostAllowed) return false;

    if (host === "github.com") {
      return url.pathname.includes("/user-attachments/assets/") || IMAGE_EXTENSIONS.test(url.pathname);
    }

    return true;
  } catch {
    return false;
  }
}

export function extractImageUrls(markdown, allowedHosts = [], maxImages = 12) {
  const candidates = [];
  const patterns = [
    /!\[[^\]]*\]\((https:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/gi,
    /<img\b[^>]*?\bsrc=["'](https:\/\/[^"']+)["'][^>]*>/gi,
    /https:\/\/github\.com\/user-attachments\/assets\/[a-zA-Z0-9-]+/gi,
    /https:\/\/(?:raw\.)?githubusercontent\.com\/[^\s<>)"']+/gi,
    /https:\/\/user-images\.githubusercontent\.com\/[^\s<>)"']+/gi
  ];

  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      candidates.push(match[1] || match[0]);
    }
  }

  const unique = [];
  for (const value of candidates) {
    const cleaned = value.replace(/&amp;/g, "&").trim();
    if (!isAllowedImageUrl(cleaned, allowedHosts)) continue;
    if (!unique.includes(cleaned)) unique.push(cleaned);
    if (unique.length >= maxImages) break;
  }
  return unique;
}

export function parseDiscussionForm(body = "") {
  const result = {};
  const headingPattern = /^###\s+(.+?)\s*$\n([\s\S]*?)(?=^###\s+|\s*$)/gm;
  for (const match of body.matchAll(headingPattern)) {
    const key = match[1].trim();
    const value = match[2]
      .replace(/<!--.*?-->/gs, "")
      .trim();
    if (value && value !== "_No response_") result[key] = value;
  }
  return result;
}

export function cleanDescription(text = "", maxLength = 320) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function categoryFromDiscussion(discussion, prefix = "category:", mappings = {}) {
  const label = discussion.labels?.nodes?.find((node) => node.name.startsWith(prefix));
  if (label) return label.name.slice(prefix.length).trim() || "other";

  const form = parseDiscussionForm(discussion.body || "");
  const formValue = form["分类"] || form["Category"];
  if (!formValue) return "other";
  const cleaned = cleanDescription(formValue, 64);
  return mappings[cleaned] || cleaned.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "other";
}

export function discussionToPost(discussion, config) {
  const images = extractImageUrls(
    discussion.body || "",
    config.allowedImageHosts,
    config.maxImagesPerDiscussion
  );
  if (images.length === 0) return null;

  const form = parseDiscussionForm(discussion.body || "");
  const descriptionSource = form["描述"] || form["Description"] || discussion.body || "";
  const labels = (discussion.labels?.nodes || []).map((node) => node.name);
  const tags = labels.filter(
    (label) =>
      label !== config.approvedLabel &&
      label !== config.submissionLabel &&
      !label.startsWith("status:")
  );

  return {
    discussionNumber: discussion.number,
    title: discussion.title,
    description: cleanDescription(descriptionSource),
    author: discussion.author?.login || "ghost",
    authorAvatar: discussion.author?.avatarUrl || "",
    category: categoryFromDiscussion(discussion, config.categoryLabelPrefix, config.categoryMappings || {}),
    categoryName: discussion.category?.name || "",
    categorySlug: discussion.category?.slug || "",
    labels,
    tags,
    images,
    coverImage: images[0],
    discussionUrl: discussion.url,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    upvoteCount: discussion.upvoteCount || 0,
    commentCount: discussion.comments?.totalCount || 0,
    source: cleanDescription(form["来源或作者"] || form["Source / author"] || "", 180),
    syncedAt: new Date().toISOString()
  };
}
