# VECT / FIELD NOTES

这是一个以文章为唯一内容源的 Hugo 静态知识站。字体、公式、搜索和文章图片均随站点部署；首页、知识地图和学习路径由文章元数据自动生成。

## 日常发文

```bash
./scripts/new.sh "文章标题" golang go-example
```

编辑 `content/posts/go-example/index.md`，随文图片可以使用相对路径，也可以先粘贴 Gitee 地址。正文从 `##` 开始，页面标题由 front matter 自动生成。

完成后只需运行：

```bash
./scripts/publish.sh "add: 文章标题"
```

发布脚本会自动收回外部图片、识别摘要/分类/标签/系列与学习顺序、更新日期、取消草稿状态、校验内容并执行生产构建。它只提交 `content/posts/` 下的文章文件；发现任何站点配置或主题改动时会立即停止，避免误提交。

## 本地检查

```bash
./scripts/validate.sh
hugo server
```

Vercel 监听 GitHub `master` 分支，文章推送后自动构建和部署。

发布后无需打开 Vercel 后台。GitHub Actions 会自动执行生产构建、桌面/手机浏览器回归和线上健康检查；失败时会通过 GitHub/Vercel 的既有通知渠道提示，上一个正常生产版本不会因构建失败被替换。

站点维护能力包括：`VECT / FIELD NOTES` 品牌水印、KaTeX 正文与目录渲染、响应式 WebP 图片、精简搜索索引、安全响应头和每周线上巡检。水印不采集任何访问者信息，也不妨碍正文和代码复制。

如需手动检查线上环境：

```bash
./scripts/smoke-test.sh
```
