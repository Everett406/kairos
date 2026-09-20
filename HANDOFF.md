# Kairos 交接文档（HANDOFF）

> 最后更新：2026-09-20 · v0.3.1 · 面向下一个接手的人（或未来的自己）

## 这是什么

Kairos 是一个 Windows 桌面卡片式小组件面板：六张卡片（天气 / 系统监控 / 番茄钟 / 音乐 / 剪贴板 / 翻译）排布在一张无边框毛玻璃面板上，点击卡片以 GSAP FLIP 动画展开为全屏详情。原 Electron + Tauri 双后端混乱架构已在 `rebuild` 分支**彻底重写**为纯 Tauri 2 + React 19。

## 当前状态

- **主分支策略**：所有开发在 `rebuild` 分支，它就是当前唯一有效分支（master 上是旧 Electron 代码，别看）。
- **已发布**：v0.3.0（NSIS 安装包，7.5 MB）。v0.3.1 为 UI 全面重设计 + 便携版支持。
- **CI**：GitHub Actions（`release.yml`），推送 `v*` tag 自动构建 NSIS + 便携版 zip 并创建 **Draft Release**。发布一律先草稿，人工审核后手动转正式——这是产品策略，不是遗漏。
- **版本约定**：版本号保持 `0.3.x`，小步递增（0.3.1、0.3.2…），不主动升 0.4 除非明确要求。

## 必须知道的事

### 1. 设计系统（改样式前先看这里）

三层结构，组件**只允许引用 semantic 层**：

```
tokens.css      原子值：灰阶 / 蓝阶 / 间距 / 字号 / 圆角 / 阴影 / 动效
theme-*.css     语义映射：表面 / 文字 / 描边 / 状态色 / 玻璃参数 / 背景氛围光
                + [data-mod='xxx'] 六个模块主题色（--k-mod 组）
primitives.css  基础组件样式：k-card / k-btn / k-field / k-tag / k-empty
```

- 每张卡片通过 `ModuleCard.tsx` 的 `data-mod={mod.id}` 注入主题色，图标芯片、悬停光晕、进度条、焦点态全部跟随 `--k-mod` 系列变量。新增模块时在 `theme-dark.css` 加一组 `[data-mod]` 即可。
- 视觉语言：「Aurora Glass」——深空蓝底（`#0a0e17`）+ 三团彩色氛围光（蓝 / 紫 / 暖橙）+ SVG 噪点压 banding + 渐变玻璃卡片（顶部 1px 内高光）。
- 亮色主题 `theme-light.css` 结构与暗色一致，但尚未覆盖 `[data-mod]` 之外的最新变量（如 `--k-glow-*`），启用前需补齐。

### 2. 通信边界

前端与 Rust 只通过 **16 个显式 command + 1 个事件**（`clipboard-changed`）通信，唯一入口 `src/lib/bridge.ts`。别绕过它直接 `invoke`。

`bridge.ts` 内置浏览器 mock 层：非 Tauri 环境（`window.__TAURI_INTERNALS__` 不存在）自动走 `mock.ts` 假数据。这是为了浏览器预览 / 截图流水线，桌面上零影响。

### 3. 数据层约定

- 模块数据 hook 做了**模块级共享缓存 + 共享轮询**（如系统监控 2s 轮询），因为卡片展开 / 收起是实例卸载重建，不做共享会重复请求。
- 番茄钟用**时间戳倒计时**（`endAtRef`）防 interval 漂移；每日计数存 localStorage（`kairos.pomodoro.*`）。
- 其余持久化走 Rust 侧 `store.rs`（JSON 原子写）。

### 4. 已知坑

- **LibreHardwareMonitor 不入 git**：CI 构建时从其 GitHub release 下载 `LibreHardwareMonitor.zip`（注意资产名，不是 `-net472.zip`）平铺进 `src-tauri/resources/`。本地开发需手动放置。
- **wmi crate 0.17 的 API**：是 `COMLibrary`（不是 COMLib），且 `WMIConnection::new(com)` / `with_namespace_path(path, com)` 都必须传入 COMLibrary 实例。
- **QQ 音乐 VIP**：免费 128k 无需登录；VIP 需要用户贴 y.qq.com 的 cookie（`uin` + `qm_keyst`），凭据存本机应用数据目录。
- **翻译**：Google 免费端点，无 key，检测语言与目标一致时自动反向（en↔zh）。

### 5. 网络环境备注（开发机）

国内访问 GitHub 不稳定时的经验：用 `dns.alidns.com/resolve` 查 `github.com` / `api.github.com` 真实 IP 写 `/etc/hosts`（github.com→20.205.243.166、api.github.com→140.82.113.6 曾有效，IP 会变需重查）。Actions 日志存在 Azure Blob，直连不通可用平台侧网络拉签名 URL。

## 发布流程（标准操作）

```bash
# 1. 改版本号（三处 + lock 同步）
#    package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml
#    src-tauri/Cargo.lock 中 kairos 包的 version 同步

# 2. 提交并打 tag
git add -A && git commit -m "..."
git tag v0.3.x
git push origin rebuild v0.3.x

# 3. 等 CI（约 12 分钟）：产出 NSIS + portable zip → Draft Release
# 4. 人工验收草稿后，GitHub Release 页面手动转正式
```

## 目录速查

| 路径 | 内容 |
| --- | --- |
| `src/design/` | 设计 token 三层 + primitives.tsx 组件 |
| `src/app/` | Titlebar / ModuleCard（FLIP）/ 外壳样式 |
| `src/features/<mod>/` | 每模块：`*Panel.tsx` + `api.ts` + `use*.ts` + `model.ts` + `*.css` |
| `src/lib/` | bridge（IPC + mock）、format |
| `src-tauri/src/commands/` | weather / system / music / clipboard / translate |
| `docs/screenshots/` | 7 张界面截图（playwright + mock 层自动生成） |
| `.github/workflows/release.yml` | 发布流水线 |

## 截图流水线（复现方式）

```bash
pnpm dev                                    # 起 Vite（5173）
cd /tmp/shot && node shot.mjs               # playwright-core 无头截图
# 产出 docs/screenshots/01~07.png；mock 层保证纯浏览器可渲染
```

## 后续可做（按优先级）

1. 亮色主题补齐新 token（`--k-glow-*`、`[data-mod]` 组）
2. 设置页（主题切换 / 开机自启 / 刷新频率）
3. 音乐：播放队列持久化、桌面歌词
4. 天气：桌面通知细分开关
5. 卡片布局自定义（拖拽排序 / 隐藏模块）
