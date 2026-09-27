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

## 网页编辑（待完成 GitHub OAuth 配置）

Pages CMS 在隔离仓库的验收未通过：旧文章目录无法打开，上传图片落到了 `content/posts/` 根目录。现已改为 Decap CMS，其官方支持 `content/posts/<slug>/index.md` 与文章同目录图片。管理入口为 `/admin/`；只有 GitHub 账号 `WoAiXueXiHa` 能通过 OAuth 回调，且需要该账号对仓库有写入权限。普通访客仍只浏览公开站点。CMS 保存会直接提交 `master`，现有 GitHub Actions 检查通过后才会部署。

首次使用前，在 GitHub Developer Settings 创建 OAuth App：Homepage URL 设为 `https://code-learn-build-evolve.vercel.app/admin/`，Authorization callback URL 设为 `https://code-learn-build-evolve.vercel.app/api/callback`。在 Vercel 项目的 **Production** 环境变量中设置 `OAUTH_GITHUB_CLIENT_ID`、`OAUTH_GITHUB_CLIENT_SECRET`、`OAUTH_REDIRECT_URI`（值为上述 callback URL）。Secret 只输入 Vercel 后台，切勿提交进仓库。购买域名后需同步更新这三个位置及 `static/admin/config.yml` 的 `base_url` 和 `site_domain`。

进入 `/admin/` 后，新文章填写英文 `slug`，文章将保存为 `content/posts/<slug>/index.md`。旧文章的路径字段保持空白。图片直接拖进正文时应存入当前文章目录；正式启用前用测试文章确认。发布时间、修改时间、主题、分类、标签和摘要都必须填写，正文从 `##` 开始。CMS 不运行本地 `publish.sh` 的自动补全或图片迁移。当前校验要求 `draft: false`，保存到 `master` 就会尝试上线；编辑器没有可靠的自动暂存，离开前请保存或复制 Markdown。

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
