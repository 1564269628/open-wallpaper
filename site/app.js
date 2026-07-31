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
  viewerTitle: document.querySelector("#viewerTitle"),
  viewerDescription: document.querySelector("#viewerDescription"),
  viewerCategory: document.querySelector("#viewerCategory"),
  viewerTags: document.querySelector("#viewerTags"),
  viewerAuthor: document.querySelector("#viewerAuthor"),
  viewerDate: document.querySelector("#viewerDate"),
  viewerStats: document.querySelector("#viewerStats"),
  viewerDots: document.querySelector("#viewerDots"),
  download: document.querySelector("#downloadImage"),
  discussion: document.querySelector("#openDiscussion"),
  previous: document.querySelector("#previousImage"),
  next: document.querySelector("#nextImage")
};

function text(value) {
  return document.createTextNode(String(value ?? ""));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

function createElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.append(text(value));
  return node;
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

  const image = document.createElement("img");
  image.src = post.coverImage;
  image.alt = post.title;
  image.loading = "lazy";
  image.decoding = "async";
  article.append(image);

  const badge = createElement("span", "card-badge", categoryNames[post.category] || post.category || "其他");
  article.append(badge);

  if (post.images.length > 1) {
    const count = createElement("span", "card-badge card-count", `${post.images.length} 张`);
    article.append(count);
  }

  const overlay = createElement("div", "card-overlay");
  overlay.append(createElement("h2", "card-title", post.title));
  const meta = createElement("div", "card-meta");
  meta.append(createElement("span", "", `@${post.author}`));
  meta.append(createElement("span", "", `★ ${post.upvoteCount} · 💬 ${post.commentCount}`));
  overlay.append(meta);
  article.append(overlay);

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
    const haystack = [post.title, post.description, post.author, ...(post.tags || [])]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return matchesCategory && (!query || haystack.includes(query));
  });

  state.filtered.sort((a, b) => {
    if (state.sort === "popular") return b.upvoteCount - a.upvoteCount;
    if (state.sort === "comments") return b.commentCount - a.commentCount;
    if (state.sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  renderGallery();
}

function setActiveImage(index) {
  const post = state.activePost;
  if (!post) return;
  const total = post.images.length;
  state.activeImageIndex = (index + total) % total;
  const url = post.images[state.activeImageIndex];
  elements.viewerImage.src = url;
  elements.viewerImage.alt = `${post.title}（${state.activeImageIndex + 1}/${total}）`;
  elements.download.href = url;
  elements.previous.hidden = total <= 1;
  elements.next.hidden = total <= 1;
  elements.viewerDots.replaceChildren();
  if (total > 1) {
    post.images.forEach((_, dotIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `查看第 ${dotIndex + 1} 张`);
      dot.setAttribute("aria-current", String(dotIndex === state.activeImageIndex));
      dot.addEventListener("click", () => setActiveImage(dotIndex));
      elements.viewerDots.append(dot);
    });
  }
}

function openViewer(post) {
  state.activePost = post;
  state.activeImageIndex = 0;
  elements.viewerTitle.textContent = post.title;
  elements.viewerDescription.textContent = post.description || "这位投稿者没有填写描述。";
  elements.viewerCategory.textContent = categoryNames[post.category] || post.category || "其他";
  elements.viewerAuthor.textContent = `@${post.author}`;
  elements.viewerDate.textContent = formatDate(post.updatedAt);
  elements.viewerStats.textContent = `★ ${post.upvoteCount} · 💬 ${post.commentCount}`;
  elements.discussion.href = post.discussionUrl;
  elements.viewerTags.replaceChildren(
    ...(post.tags || []).map((tag) => createElement("span", "", tag.replace(/^category:/, "")))
  );
  setActiveImage(0);
  elements.viewer.showModal();
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
document.querySelector("#closeViewer").addEventListener("click", () => elements.viewer.close());
elements.viewer.addEventListener("click", (event) => {
  if (event.target === elements.viewer) elements.viewer.close();
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
