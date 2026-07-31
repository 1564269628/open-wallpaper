const repository = "1564269628/open-wallpaper";
const categoryNames = {
  all: "全部",
  anime: "二次元",
  photography: "摄影",
  illustration: "插画",
  minimal: "极简",
  landscape: "风景",
  other: "其他"
};

const state = {
  posts: [],
  filtered: [],
  category: "all",
  query: "",
  sort: "updated",
  activePost: null,
  activeImageIndex: 0
};

const elements = {
  gallery: document.querySelector("#gallery"),
  status: document.querySelector("#status"),
  empty: document.querySelector("#emptyState"),
  count: document.querySelector("#imageCount"),
  search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortSelect"),
  filters: document.querySelector("#categoryFilters"),
  theme: document.querySelector("#themeButton"),
  viewer: document.querySelector("#viewer"),
  viewerImage: document.querySelector("#viewerImage"),
  viewerLoading: document.querySelector("#viewerLoading"),
  viewerTitle: document.querySelector("#viewerTitle"),
  viewerDescription: document.querySelector("#viewerDescription"),
  viewerCategory: document.querySelector("#viewerCategory"),
  viewerTags: document.querySelector("#viewerTags"),
  viewerAuthorAvatar: document.querySelector("#viewerAuthorAvatar"),
  viewerAuthorLink: document.querySelector("#viewerAuthorLink"),
  viewerDate: document.querySelector("#viewerDate"),
  viewerStats: document.querySelector("#viewerStats"),
  viewerCommentSummary: document.querySelector("#viewerCommentSummary"),
  viewerComments: document.querySelector("#viewerComments"),
  viewerDots: document.querySelector("#viewerDots"),
  download: document.querySelector("#downloadImage"),
  discussion: document.querySelector("#openDiscussion"),
  discussionTop: document.querySelector("#openDiscussionTop"),
  previous: document.querySelector("#previousImage"),
  next: document.querySelector("#nextImage")
};

function text(value) {
  return document.createTextNode(String(value ?? ""));
}

function createElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.append(text(value));
  return node;
}

function formatDate(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function githubProfile(login) {
  return login && login !== "ghost" ? `https://github.com/${encodeURIComponent(login)}` : "https://github.com";
}

function imageRecord(post, index = 0) {
  const item = post.images?.[index];
  if (typeof item === "string") {
    return {
      original: item,
      thumbnail: index === 0 ? post.coverThumbnail || item : item,
      width: null,
      height: null
    };
  }
  if (item && typeof item === "object") {
    return {
      original: item.original || item.thumbnail || post.coverImage || "",
      thumbnail: item.thumbnail || item.original || post.coverThumbnail || post.coverImage || "",
      width: item.width || null,
      height: item.height || null
    };
  }
  return {
    original: post.coverImage || "",
    thumbnail: post.coverThumbnail || post.coverImage || "",
    width: null,
    height: null
  };
}

function imageCount(post) {
  return Array.isArray(post.images) && post.images.length ? post.images.length : 1;
}

function safeAvatar(image, fallbackLogin = "") {
  const fallback = `https://github.com/identicons/${encodeURIComponent(fallbackLogin || "ghost")}.png`;
  image.alt = fallbackLogin ? `${fallbackLogin} 的头像` : "用户头像";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  if (!image.getAttribute("src")) image.src = fallback;
  image.onerror = () => {
    if (image.src !== fallback) image.src = fallback;
  };
}

function renderFilters() {
  elements.filters.replaceChildren();
  const available = ["all", ...new Set(state.posts.map((post) => post.category || "other"))];
  for (const category of available) {
    const button = createElement("button", "filter-chip", categoryNames[category] || category);
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(state.category === category));
    button.addEventListener("click", () => {
      state.category = category;
      renderFilters();
      applyFilters();
    });
    elements.filters.append(button);
  }
}

function createCard(post) {
  const article = createElement("article", "card");
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", `查看 ${post.title}`);

  const media = createElement("div", "card-media");
  const image = document.createElement("img");
  const record = imageRecord(post, 0);
  image.src = record.thumbnail;
  image.alt = post.title;
  image.loading = "lazy";
  image.decoding = "async";
  if (record.width && record.height) image.style.aspectRatio = `${record.width} / ${record.height}`;
  image.addEventListener("error", () => {
    if (record.original && image.src !== record.original) image.src = record.original;
  });
  media.append(image);
  media.append(createElement("span", "card-badge", categoryNames[post.category] || post.category || "其他"));
  if (imageCount(post) > 1) media.append(createElement("span", "card-badge card-count", `${imageCount(post)} 张`));
  article.append(media);

  const info = createElement("div", "card-info");
  info.append(createElement("h2", "card-title", post.title));
  const footer = createElement("div", "card-footer");
  const author = createElement("div", "card-author");
  const avatar = document.createElement("img");
  avatar.src = post.authorAvatar || "";
  safeAvatar(avatar, post.author);
  author.append(avatar, createElement("span", "", post.author || "ghost"));
  const stats = createElement("div", "card-stats");
  stats.append(createElement("span", "", `♡ ${post.upvoteCount || 0}`));
  stats.append(createElement("span", "", `💬 ${post.commentCount || 0}`));
  footer.append(author, stats);
  info.append(footer);
  article.append(info);

  const open = () => openViewer(post);
  article.addEventListener("click", open);
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return article;
}

function renderGallery() {
  elements.gallery.replaceChildren(...state.filtered.map(createCard));
  elements.status.hidden = true;
  elements.empty.hidden = state.filtered.length > 0;
}

function applyFilters() {
  const query = state.query.toLocaleLowerCase("zh-CN");
  state.filtered = state.posts.filter((post) => {
    const matchesCategory = state.category === "all" || post.category === state.category;
    const commentText = (post.comments || []).map((comment) => comment.body || "").join(" ");
    const haystack = [post.title, post.description, post.author, ...(post.tags || []), commentText]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return matchesCategory && (!query || haystack.includes(query));
  });

  state.filtered.sort((a, b) => {
    if (state.sort === "popular") return (b.upvoteCount || 0) - (a.upvoteCount || 0);
    if (state.sort === "comments") return (b.commentCount || 0) - (a.commentCount || 0);
    if (state.sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  renderGallery();
}

function renderComment(comment, nested = false) {
  const article = createElement("article", "comment");
  const avatar = document.createElement("img");
  avatar.className = "comment-avatar";
  avatar.src = comment.authorAvatar || "";
  safeAvatar(avatar, comment.author);
  article.append(avatar);

  const main = createElement("div", "comment-main");
  const head = createElement("div", "comment-head");
  const author = createElement("a", "", comment.author || "ghost");
  author.href = githubProfile(comment.author);
  author.target = "_blank";
  author.rel = "noreferrer";
  const time = document.createElement("time");
  time.dateTime = comment.createdAt || "";
  time.append(text(formatDate(comment.createdAt)));
  head.append(author, time);
  main.append(head, createElement("p", "comment-body", comment.body || "（空评论）"));

  if (!nested && Array.isArray(comment.replies) && comment.replies.length) {
    const replies = createElement("div", "comment-replies");
    replies.append(...comment.replies.map((reply) => renderComment(reply, true)));
    if ((comment.replyCount || 0) > comment.replies.length) {
      replies.append(createElement("div", "comment-more", `还有 ${(comment.replyCount || 0) - comment.replies.length} 条回复，请前往 GitHub 查看`));
    }
    main.append(replies);
  }
  article.append(main);
  return article;
}

function renderComments(post) {
  const comments = Array.isArray(post.comments) ? post.comments : [];
  elements.viewerCommentSummary.textContent = `共 ${post.commentCount || comments.length} 条`;
  if (!comments.length) {
    elements.viewerComments.replaceChildren(createElement("div", "comment-empty", "暂时没有评论，去 GitHub 留下第一条吧。"));
    return;
  }
  elements.viewerComments.replaceChildren(...comments.map((comment) => renderComment(comment)));
}

function setActiveImage(index) {
  const post = state.activePost;
  if (!post) return;
  const total = imageCount(post);
  state.activeImageIndex = (index + total) % total;
  const record = imageRecord(post, state.activeImageIndex);

  elements.viewerImage.dataset.loading = "true";
  elements.viewerLoading.hidden = false;
  elements.viewerImage.alt = `${post.title}（${state.activeImageIndex + 1}/${total}）`;
  elements.viewerImage.src = record.original;
  elements.download.href = record.original;
  elements.previous.hidden = total <= 1;
  elements.next.hidden = total <= 1;
  elements.viewerDots.replaceChildren();

  if (total > 1) {
    for (let dotIndex = 0; dotIndex < total; dotIndex += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `查看第 ${dotIndex + 1} 张`);
      dot.setAttribute("aria-current", String(dotIndex === state.activeImageIndex));
      dot.addEventListener("click", () => setActiveImage(dotIndex));
      elements.viewerDots.append(dot);
    }
  }
}

function openViewer(post) {
  state.activePost = post;
  state.activeImageIndex = 0;
  elements.viewerTitle.textContent = post.title;
  elements.viewerDescription.textContent = post.description || "这位投稿者没有填写描述。";
  elements.viewerCategory.textContent = categoryNames[post.category] || post.category || "其他";
  elements.viewerAuthorLink.textContent = `@${post.author || "ghost"}`;
  elements.viewerAuthorLink.href = githubProfile(post.author);
  elements.viewerAuthorAvatar.src = post.authorAvatar || "";
  delete elements.viewerAuthorAvatar.dataset.fallback;
  safeAvatar(elements.viewerAuthorAvatar, post.author);
  elements.viewerDate.textContent = `更新于 ${formatDate(post.updatedAt)}`;
  elements.viewerStats.textContent = `♡ ${post.upvoteCount || 0} · 💬 ${post.commentCount || 0}`;
  elements.discussion.href = post.discussionUrl;
  elements.discussionTop.href = post.discussionUrl;
  elements.viewerTags.replaceChildren(
    ...(post.tags || []).map((tag) => createElement("span", "", tag.replace(/^category:/, "")))
  );
  renderComments(post);
  document.body.classList.add("modal-open");
  elements.viewer.showModal();
  setActiveImage(0);
}

function closeViewer() {
  elements.viewer.close();
  elements.viewerImage.removeAttribute("src");
  state.activePost = null;
  document.body.classList.remove("modal-open");
}

function initializeTheme() {
  const stored = localStorage.getItem("open-wallpaper-theme");
  const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = stored || preferred;
}

async function loadGallery() {
  try {
    const response = await fetch("data/images.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const posts = await response.json();
    state.posts = Array.isArray(posts) ? posts : [];
    elements.count.textContent = new Intl.NumberFormat("zh-CN").format(state.posts.length);
    renderFilters();
    applyFilters();
  } catch (error) {
    elements.status.textContent = `画廊加载失败：${error.message}`;
    elements.status.hidden = false;
  }
}

elements.viewerImage.addEventListener("load", () => {
  elements.viewerImage.dataset.loading = "false";
  elements.viewerLoading.hidden = true;
});
elements.viewerImage.addEventListener("error", () => {
  elements.viewerImage.dataset.loading = "false";
  elements.viewerLoading.textContent = "原图加载失败，请在 GitHub 中查看。";
  elements.viewerLoading.hidden = false;
});
elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  applyFilters();
});
elements.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  applyFilters();
});
elements.theme.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("open-wallpaper-theme", next);
});
document.querySelector("#closeViewer").addEventListener("click", closeViewer);
elements.viewer.addEventListener("click", (event) => {
  if (event.target === elements.viewer) closeViewer();
});
elements.viewer.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeViewer();
});
elements.previous.addEventListener("click", () => setActiveImage(state.activeImageIndex - 1));
elements.next.addEventListener("click", () => setActiveImage(state.activeImageIndex + 1));
document.addEventListener("keydown", (event) => {
  if (!elements.viewer.open) return;
  if (event.key === "ArrowLeft") setActiveImage(state.activeImageIndex - 1);
  if (event.key === "ArrowRight") setActiveImage(state.activeImageIndex + 1);
});

document.querySelector("#discussionsLink").href = `https://github.com/${repository}/discussions`;
document.querySelector("#submitLink").href = `https://github.com/${repository}/discussions/new?category=show-and-tell`;
initializeTheme();
loadGallery();
