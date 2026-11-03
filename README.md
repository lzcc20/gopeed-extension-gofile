# Gopeed Gofile 扩展（重写版）

一个用于 [Gopeed](https://gopeed.com) 的扩展，自动解析 **Gofile.io** 的分享链接并下载。
支持**单文件**和**整个文件夹（含多层子文件夹递归）**。

> 这是社区扩展 `leenc123/gopeed-extension-gofile` 的重写版。原扩展因为写死了
> `Host` 请求头、且依赖手动填写、容易过期的 `Authorization` / `accountToken` 而失效。
> 本版本改为自动获取并缓存令牌、递归下载子文件夹、按文件实际存储服务器下载。

## 安装

1. 打开 Gopeed → **扩展** 页面。
2. 在扩展页面**连续点击 5 次「安装」按钮**，开启开发者模式（仅桌面端）。
3. 点击「从 Git 安装」，输入本仓库地址并安装：
   ```
   https://github.com/YOUR_GITHUB_USERNAME/gopeed-extension-gofile
   ```
   （把 `YOUR_GITHUB_USERNAME` 换成实际用户名；子目录安装用 `#` 分隔，本仓库根目录无需加）

也可以直接把本仓库克隆到本地，在开发者模式下「选择目录」安装（便于调试）。

## 使用

1. 在浏览器复制任意 Gofile 分享链接，例如：
   - 文件夹：`https://gofile.io/d/AbCdEfGh`
   - 单文件：`https://gofile.io/d/AbCdEfGh`
2. 打开 Gopeed，它会监听剪贴板自动弹出解析结果；或点「新建」手动粘贴链接。
3. 确认文件列表后开始下载。

> 扩展会自动创建游客账号并完成鉴权，**通常无需任何配置**即可使用。

## 设置（可选）

扩展提供一项设置 `Gofile API Token`：

- **留空（默认）**：自动创建游客账号，零配置即用。游客账号有速率/容量限制，但对下载公共分享完全够用。
- **填入你自己的 Token**：在 [gofile.io 个人资料页](https://gofile.io/myProfile) 复制 API 令牌填入，
  可享有你账户的限额。填入后扩展会优先使用它，并缓存起来。

## 工作原理

1. 从链接中提取内容 ID（`/d/` 后面的那段）。
2. 获取 token：`缓存 → 设置项 → 自动 POST https://api.gofile.io/accounts 创建游客账号`。
3. 调用 `GET https://api.gofile.io/contents/{id}`（带 `Authorization: Bearer` 头）拉取文件列表。
4. 遇到子文件夹则递归拉取；分页通过 `metadata.hasNextPage` 处理。
5. 把每个文件的直链（`link`，位于 `store-x.gofile.io`）连同必要的请求头（含 `accountToken` Cookie）交给 Gopeed 下载。

## 已知限制

- **不支持带密码的文件夹**：Gofile 密码需要 SHA-256 计算，而 Gopeed 的 JS 运行环境（goja）没有内置
  crypto，故未实现。如需下载加密文件夹，可先在浏览器里用密码解开后再分享无密码链接。
- 极少数情况下游客账号触发限流（HTTP 429），可填入自己的 Token 重试。

## 开发 / 调试

本扩展为**纯 JS、免构建**实现（参照 Gopeed 官方“手动搭建”方式），直接修改 `index.js` 即可，
无需 webpack / npm。开启开发者模式安装本地目录后，日志在 Gopeed 安装目录 `logs/extension.log`：

```bash
tail -f logs/extension.log
```

## 许可证

MIT
