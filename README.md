# Open Wallpaper

一个完全托管在 GitHub 上的开放壁纸社区：

- **GitHub Discussions**：投稿、附件存储、作者身份、评论、点赞和审核。
- **GitHub Actions**：监听 Discussion 创建、编辑、删除、标签和分类变化，增量同步单个帖子；每天全量校准。
- **GitHub Pages**：匿名访问的静态瀑布流画廊，不在浏览器中暴露 Token。

## 工作方式

```text
投稿者在 Show and tell 分类创建 Discussion 并拖入图片
                         ↓
管理员添加 approved 标签
                         ↓
Sync discussions 只读取发生变化的 Discussion
                         ↓
data/posts/<讨论编号>.json
                         ↓
Deploy GitHub Pages 合并本地 JSON 并生成静态站点
```

Discussion 被编辑、替换图片、移除 `approved`、更换分类或删除后，网站会自动更新。每天北京时间 **03:23** 还会进行一次全量校准，修复偶发的事件遗漏。

## 第一次启用

首次提交后，`Bootstrap gallery` 工作流会自动：

1. 创建审核和分类标签；
2. 在 `Show and tell` 分类创建两个真实的测试 Discussion；
3. 给测试帖子添加 `approved` 和分类标签；
4. 全量生成 `data/posts/*.json`。

GitHub Pages 需要在仓库中启用一次：

1. 打开 **Settings → Pages**；
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**；
3. 打开 **Actions → Deploy GitHub Pages → Run workflow**。

网站地址：`https://1564269628.github.io/open-wallpaper/`

## 审核与分类

| 标签 | 作用 |
|---|---|
| `submission` | 投稿表单自动添加 |
| `approved` | 管理员审核通过；只有带此标签的 Discussion 才会公开 |
| `category:anime` | 二次元 |
| `category:photography` | 摄影 |
| `category:illustration` | 插画 |
| `category:minimal` | 极简 |
| `category:landscape` | 风景 |
| `category:other` | 其他 |
| `content:ai` | AI 生成内容标记 |
| `status:hidden` | 管理用途；移除 `approved` 才会真正下架 |

分类标签优先于投稿表单中的“分类”字段。管理员可以直接在 Discussion 右侧添加或修改标签。

## 投稿要求

- 图片必须通过 GitHub Discussion 编辑器拖拽上传，或使用 GitHub 托管的图片地址。
- 默认最多读取一个 Discussion 中的 12 张图片，第一张作为封面。
- 为避免访问者 IP 泄漏给任意第三方图床，构建脚本只接受 GitHub 托管域名。
- 投稿者必须确认拥有发布权，且内容不违法、不露骨色情、不恶意侵权、不泄露隐私。

## 管理操作

- **发布**：添加 `approved`。
- **下架**：移除 `approved`。
- **改分类**：修改 `category:*` 标签。
- **替换图片**：投稿者编辑 Discussion 正文，删除旧图片并上传新图。
- **强制重建**：Actions → `Sync discussions` → Run workflow。
- **重新部署**：Actions → `Deploy GitHub Pages` → Run workflow。

## 本地测试

需要 Node.js 20 或更高版本：

```bash
npm test
npm run build
python -m http.server 8080 -d dist
```

然后访问 `http://localhost:8080`。

## 目录结构

```text
.github/DISCUSSION_TEMPLATE/  投稿表单
.github/workflows/            初始化、同步和 Pages 部署
data/posts/                   每个 Discussion 一个静态 JSON
scripts/                      GitHub API、解析、同步与构建脚本
site/                         无框架静态前端
tests/                        Node.js 内置测试
```

## 安全设计

- 前端不包含 GitHub Token，也不调用 Discussions GraphQL API。
- 所有 API 调用只发生在 Actions 内，并使用最小化的 `GITHUB_TOKEN` 权限。
- 用户文本通过 DOM 文本节点渲染，避免直接插入 HTML。
- 图片 URL 在构建阶段执行 HTTPS 与域名白名单校验。

MIT License
