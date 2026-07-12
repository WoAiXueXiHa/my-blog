# VECT / FIELD NOTES

这是一个自包含的 Hugo 静态站点。字体、公式、搜索和文章图片均随站点部署，日常不需要维护前端依赖。

## 日常发文

```bash
./scripts/new.sh "文章标题" golang go-example
```

编辑 `content/posts/go-example/index.md`，随文图片直接放在同一目录并使用相对路径引用。正文从 `##` 开始，页面标题由 front matter 自动生成。

完成后只需运行：

```bash
./scripts/publish.sh "add: 文章标题"
```

发布脚本会自动更新日期、取消草稿状态、校验标题与图片、执行生产构建，并且只提交 `content/posts/` 下的文章文件。发现任何站点配置或主题改动时会立即停止，避免误提交。

## 本地检查

```bash
./scripts/validate.sh
hugo server
```

Vercel 监听 GitHub `master` 分支，文章推送后自动构建和部署。
