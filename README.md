# 书衣

为微信读书网页版（weread.qq.com）阅读页换一层"书衣"的浏览器扩展：把正文改排成博客、在线文档、电子表格、代码编辑器或终端日志的外观，并可伪装标签页标题与网站图标。基于 [WXT](https://wxt.dev) 构建，使用 Manifest V3，支持 Chrome 与 Edge（Chromium 内核）。

## 功能

* **文章模式**：以所选外观重新排版阅读页正文，支持选择和复制文字。
* **外观**：博客文章、在线文档、电子表格、代码编辑器、终端日志。
* **隐藏划线、批注和想法气泡**。
* **标签页伪装**：标题与网站图标跟随外观，标题也可自定义。

设置在工具栏弹窗中修改并自动保存，仅对微信读书阅读页（`https://weread.qq.com/web/*`）生效。

## 安装

* 从 [GitHub Releases](https://github.com/Podul/wxt-weread/releases) 下载 zip 包，解压后按下文步骤加载。

## 环境要求

* Node.js 22+
* pnpm

## 构建

```bash
pnpm install
pnpm build
```

构建产物位于 `.output/chrome-mv3/`，Chrome 和 Edge 共用这一份。

## 在 Chrome 中安装

1. 地址栏输入 `chrome://extensions` 并回车。
2. 打开右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择 `.output/chrome-mv3` 目录（或解压后的 zip 目录）。
5. （可选）点击工具栏拼图图标，把「书衣」固定到工具栏。

## 在 Edge 中安装

1. 地址栏输入 `edge://extensions` 并回车。
2. 打开左侧（或页面底部）的「开发人员模式」。
3. 点击「加载解压缩的扩展」。
4. 选择 `.output/chrome-mv3` 目录（或解压后的 zip 目录）。
5. （可选）点击工具栏扩展图标，把「书衣」固定到工具栏。

> Edge 基于 Chromium，可直接使用 Chrome 的构建产物。也可以执行 `pnpm build -b edge` 生成 `.output/edge-mv3`，二者功能一致。

## 打包

```bash
pnpm package       # 生成 Chrome zip 包
pnpm package:edge  # 生成 Edge zip 包
pnpm package:all   # 一次生成两者
```

zip 包输出到 `.output/`。本地使用请解压后按上面的步骤加载，Chrome 和 Edge 都不能直接拖入 zip 安装。

## 发布 Release

推送形如 `vX.Y.Z` 的 tag 会触发 `.github/workflows/release.yml`：以 tag 版本号覆盖 `package.json` 版本，执行类型检查并打包，然后把 `.output/*-chrome.zip` 和 `.output/*-edge.zip` 上传到对应的 GitHub Release。

```bash
git tag v0.1.0
git push origin v0.1.0
```

推送到 `main` 或提交 PR 时，`.github/workflows/ci.yml` 会执行类型检查与构建。

## 开发

```bash
pnpm dev       # 启动开发模式（自动打开带扩展的浏览器并热更新）
pnpm compile   # 类型检查
```

## 常见问题

* **更新代码后没有生效**：重新执行 `pnpm build`，然后在扩展管理页点击该扩展的「重新加载」按钮，再刷新微信读书阅读页。
* **提示「清单文件缺失或不可读」**：选错了目录，应选择包含 `manifest.json` 的 `.output/chrome-mv3`，而不是项目根目录。
* **重启浏览器后出现「请停用开发者模式扩展」提示**（主要在 Chrome）：这是未上架商店的本地扩展的正常提示，忽略或关闭即可。
