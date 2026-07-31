# Open Wallpaper

一个完全托管在 GitHub 上的开放壁纸社区。

- **GitHub Discussions**：投稿、原图附件、作者身份、评论、点赞和审核。
- **GitHub Actions**：监听帖子与评论变化，生成公开 JSON 和 WebP 缩略图。
- **`thumbnails` 分支**：只保存当前缩略图快照，不保留缩略图修改历史。
- **GitHub Pages**：匿名浏览的小红书式瀑布流页面，前端不包含 Token。

## 数据流

```text
Discussion 投稿、原图和评论
           ↓
管理员添加 approved
           ↓
Action 增量读取发生变化的 Discussion
           ↓
main:data/posts/<编号>.json
thumbnails:thumbs/<编号>/<序号>-<哈希>.webp
           ↓
GitHub Pages 构建静态 images.json
           ↓
首页加载 WebP；点击后才加载原图
```

## 当前功能

- 小红书式多列瀑布流，卡片显示作者头像、标题、点赞数和评论数。
- 桌面端详情为左侧原图、右侧作者/正文/评论；手机端上下布局。
- 网页只读展示最新 30 条 GitHub 评论及每条评论的最新 5 条回复。
- “去 GitHub 评论”按钮打开原 Discussion，网页本身不处理登录和写评论。
- 每张图片生成最大宽度 640px、质量 74 的 WebP 缩略图。
- `thumbnails` 是孤儿快照分支，每次强制替换为当前有效缩略图集合。
- Discussion 创建、编辑、删除、增删标签、换分类及评论变化都会增量同步。
- 每天北京时间 03:23 全量校准一次。

## 审核和分类

只有同时满足以下条件的 Discussion 会发布：

1. 位于允许的 Discussion 分类（默认 `Show and tell`）；
2. 带有 `approved` 标签；
3. 没有 `status:hidden` 标签；
4. 正文中至少包含一张允许的 GitHub 托管图片。

分类标签：

- `category:anime`
- `category:photography`
- `category:illustration`
- `category:minimal`
- `category:landscape`
- `category:other`
- `content:ai`

## 缩略图分支

`thumbnails` 分支不从 `main` 继承历史。Action 每次发布时都会创建一个新的根提交并强制更新该分支：

```text
thumbnails/
├── README.md
├── manifest.json
└── thumbs/
    └── <Discussion编号>/
        ├── 0-<原图URL哈希>.webp
        └── 1-<原图URL哈希>.webp
```

删除或替换 Discussion 图片后，下一次快照中不会再包含旧缩略图。旧 Git 对象何时从 GitHub 服务器物理回收由 GitHub 的垃圾回收机制决定。

## 工作流

- `Bootstrap gallery`：创建标签和测试 Discussion，全量同步并初始化缩略图分支。
- `Sync discussions`：帖子或评论变化时增量同步；定时全量校准。
- `Pull request checks`：在 PR 中安装 Sharp、运行测试、检查脚本并构建静态站点。
- `Deploy GitHub Pages`：测试、生成 `dist/` 并发布 Pages。

## 本地开发

需要 Node.js 20.9 或更高版本：

```bash
npm install
npm test
npm run build
python -m http.server 8080 -d dist
```

生成本地缩略图快照：

```bash
THUMBNAIL_DIR=.thumbnail-store \
GITHUB_REPOSITORY=1564269628/open-wallpaper \
npm run thumbnails
```

## 安全设计

- 浏览器不调用 GitHub Discussions API，也不包含 GitHub Token。
- 评论使用 GraphQL 的 `bodyText`，前端通过 `textContent`/文本节点渲染。
- 原图只接受 HTTPS 和 GitHub 托管域名。
- Action 对下载图片设置超时、大小和像素数量限制。
- 投稿、评论和点赞继续在 GitHub 中进行。

MIT License
