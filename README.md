# VECT / FIELD NOTES

这是一个以文章为唯一内容源的 Hugo 静态知识站。字体、公式、搜索和文章图片均随站点部署；首页、知识地图和学习路径由文章元数据自动生成。

## 日常发文

```bash
./scripts/new.sh "文章标题" golang go-example
```

编辑 `content/posts/go-example/index.md`，正文从 `##` 开始，页面标题由 front matter 自动生成。发布前需要填写时间并将 `draft` 改为 `false`；摘要、分类、标签和系列可以手动填写，留空时由发布脚本自动补全。文章中的 Gitee 图床图片会先下载到临时文件，验证图片有效后再原子迁移到文章目录并改为相对路径；其他外部图片仍会被校验拦截。

完成后只需运行：

```bash
./scripts/publish.sh "add: 文章标题"
```

发布脚本只完成以下工作：

1. 确认当前位于已同步的 `master`，且只有 `content/posts/` 发生变化。
2. 自动迁移文章中的 Gitee 外链图片。
3. 自动补全缺失或过短的摘要，以及缺失的分类、标签、系列和系列顺序。
4. 校验 UTF-8、元数据、草稿状态、发布时间、图片、Hugo 构建、链接、单元测试和浏览器回归。
5. 执行 `git add`、`git commit`、`git push origin master`。

脚本不会更新时间或取消草稿，也不会创建分支、Pull Request 或执行 merge。发现任何站点配置或主题改动时会立即停止，避免误提交。

如需单独检查文章，可运行：

```bash
./scripts/validate.sh
```

## 网页编辑

编辑器与公开博客分属不同来源。使用 [修改旧文](https://woaixuexiha.github.io/my-blog-editor/) 和 [新建文章](https://woaixuexiha.github.io/my-blog-editor/new/) 两个入口；它们由独立 GitHub Pages 仓库提供，均写入博客仓库的 `master`。旧文入口只允许编辑，避免误用新建路径；新文入口要求英文 `slug`。博客继续使用严格的 CSP。Pages CMS 在隔离仓库中无法打开旧文章目录，且上传图片落到文章目录之外，因此改用 Decap CMS。只有 GitHub 账号 `WoAiXueXiHa` 能通过 OAuth 回调取得编辑令牌；仓库写权限仍由 GitHub 控制。普通访客只能浏览公开站点。

GitHub OAuth App 的 Authorization callback URL 为 `https://code-learn-build-evolve.vercel.app/api/callback`，Homepage URL 可设为上述编辑器地址。Vercel Production 需配置 `OAUTH_GITHUB_CLIENT_ID`、`OAUTH_GITHUB_CLIENT_SECRET` 和 `OAUTH_REDIRECT_URI`（值为 callback URL）；更新变量后要重新部署。密钥仅保存在 Vercel，不进 Git。回调只向 `https://woaixuexiha.github.io` 这个编辑来源发送令牌；若未来换独立域名，需要同时修改回调来源和 OAuth App 的 Homepage URL。

新文章须填写英文 `slug`，保存为 `content/posts/<slug>/index.md`。旧文编辑时路径字段保持空白，避免改变公开链接。正文可在 Markdown 原文与可视化模式之间切换；复杂代码和公式建议用原文模式，可视化模式保存前需核对差异。通过图片按钮选择本地文件，图片会保存到当前文章目录；图片 Markdown 必须有说明文字，例如 `![结构图](diagram.png)`。Gitee 外链图片会因防盗链而在编辑器里失效，且现有发布校验禁止外部图片；请先下载到电脑再上传。发布时间、修改时间、主题、分类、标签和摘要都必须填写，正文从 `##` 开始。CMS 不运行本地 `publish.sh` 的自动补全或图片迁移；保存会直接提交 `master`，Actions 校验通过后才部署。当前校验要求 `draft: false`，编辑器没有可靠的自动暂存，离开前请保存或复制 Markdown。

文章与图片备份位于本机 `backups/content-posts-before-web-editor-20260927.tar.gz`（已加入 `.gitignore`），同目录有 SHA-256 校验和；Git 恢复标记为 `before-web-editor-20260927`。请另复制到可靠的外部存储。

## 本地检查

```bash
./scripts/check.sh
hugo server
```

`check.sh` 是本地发布与 GitHub Actions 共用的完整质量门禁。首次运行前需要执行 `npm ci`，并确保 Playwright Chromium 已安装。

文章资源限制为单文件不超过 8 MiB、单篇文章合计不超过 40 MiB；全站文章资源超过 150 MiB 时会给出容量告警。

GitHub Actions 监听 `master`。质量检查通过后，才会使用 Vercel CLI 构建并部署生产环境；检查失败时，线上继续保留上一成功版本。

发布后无需打开 Vercel 后台。GitHub Actions 会自动执行 Hugo 构建、桌面/手机浏览器回归、生产部署和线上健康检查；失败时通过 GitHub 的既有通知渠道提示。

站点维护能力包括：KaTeX 正文与目录渲染、响应式 WebP 图片、精简搜索索引、安全响应头、每日线上巡检和每周依赖审计。

如需手动检查线上环境：

```bash
./scripts/smoke-test.sh
```

## CI/CD 配置

生产部署需要以下 GitHub 配置：

- Secret：`VERCEL_TOKEN`
- Variable：`VERCEL_ORG_ID`
- Variable：`VERCEL_PROJECT_ID`

Vercel 的 Git 自动部署已关闭，生产发布只由通过质量检查的 GitHub Actions 执行。
