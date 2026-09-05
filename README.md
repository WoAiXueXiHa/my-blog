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
