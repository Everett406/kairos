# Kairos 交接文档（HANDOFF）

> 最后更新：2026-09-20 · v0.3.1 · 读者：下一个接手的人、未来的自己、协助开发的 AI

## 0. 项目沿革（前世今生）

| 时间 | 事件 |
| --- | --- |
| 2026-09-04 | 上游 At210Co60/kairos 建仓，首个提交「Kairos 液态玻璃桌面助手」（Electron + React 19 路线） |
| 2026-09-05 ~ 09-06 | Electron 壳 + 系统硬件监控完善；风扇转速改用 Lenovo Legion Toolkit 同款 WMI 通道 |
| 2026-09-16 | 上游活跃收官：自研 WebGL 折射层、提权改走计划任务、README 重写；`main` 停在 `86f0f87` |
| 2026-09-20 | Fork 至 Everett406/kairos；同日完成 **Tauri 2 全面重构**（`5aa7067`，移除 Electron 双后端、六模块重写、建立设计 token 体系与 CI），修复 LHM 下载 404 与 wmi 0.17 API 两处 CI 问题（`c61ce9a`、`a52c17f`），发布 **v0.3.0** |
| 2026-09-20 | **Aurora Glass UI 重设计** + 便携版支持（`85fcfb0`）→ **v0.3.1**（Draft，发布事故见 §6） |

**分支现状：**

| 分支 | 状态 |
| --- | --- |
| `main` | 旧 Electron 快照，仅作历史存档（默认分支） |
| `rebuild` | **唯一主线**，Tauri 2 + React 19，所有开发与发版都在这里 |
| `fix/glass-stability-and-perf` | 上游遗留的 Electron 修复分支，未合入；Tauri 重写后已无实际意义 |

## 1. 当前状态

- **已发布**：v0.3.0 / v0.3.1（均正式，双产物：NSIS 安装包 + 便携版 zip）。
- **v0.4.0（当前）**：UI 按「Quiet Instrument」视觉稿全面重构 —— 主画布仪表 + 指标抽屉 + 九宫格功能面板 + 全局命令条 + 专注场景；Tauri 侧新增全局热键（Ctrl+Alt+K）与 acrylic 磨砂窗体。版本四处已同步为 `0.4.0`。
- **CI 运行史**：v0.3.x 两次事故均已修复（见 §6）；release.yml 未变，直接复用。
- **文档**：README 为产品主页风（已随 v0.4 重写）；本文档负责工程细节与决策记录。

## 2. 版本纪律（硬约束）

- **0.3.x → 0.4.0**：v0.4.0 因 UI 架构级重构（外壳重写 + 全局热键 + acrylic）升 minor，符合例外条款并记录在案；后续若无同类决策仍只动 patch 位。
- **改版本号必须四处同步**，漏一处 CI 就会产出错版号的产物：

```bash
# 改完用这条命令自检，四处输出必须一致
grep -E '"version"' package.json src-tauri/tauri.conf.json
grep -E '^version' src-tauri/Cargo.toml
grep -A1 'name = "kairos"' src-tauri/Cargo.lock | grep version
```

- **tag 必须与 `tauri.conf.json` 的 version 一致**：tauri-action 用 `v__VERSION__` 定位 release，两边对不上会建出孤儿草稿。

## 3. 发布流程（标准操作）

```bash
# 1. 同步版本号（四处，见 §2）
# 2. 提交并打 tag
git add -A && git commit -m "..."
git tag v0.3.x
git push origin rebuild v0.3.x
# 3. 等 CI（约 12 分钟）：NSIS + portable zip → Draft Release
# 4. 人工验收草稿（装一遍安装包、跑一遍便携版），GitHub Release 页手动转正式
```

**Draft-first 是产品策略，不是遗漏**：任何版本先出草稿，验收后才转正。

## 4. Action（release.yml）运作详解

`.github/workflows/release.yml`，单 job `build-windows`（windows-latest）。

**触发方式**：① push `v*` tag；② 手动 `workflow_dispatch`（Actions 页选 `rebuild` 分支运行，构建的是该分支 HEAD，不是某个 tag）。

**逐步骤拆解：**

| # | 步骤 | 做什么 | 关键细节 |
| --- | --- | --- | --- |
| 1 | checkout / pnpm / Node / Rust | 环境准备 | pnpm 10 + Node 22 + Rust stable；`swatinem/rust-cache` 按 `src-tauri` 缓存，命中后编译约省一半时间 |
| 2 | Download LibreHardwareMonitor | 填充 `src-tauri/resources/` | 从 LHM 的 GitHub latest release 下载 **`LibreHardwareMonitor.zip`**（注意资产名，不是 `-net472.zip`）；解压平铺并断言 exe 存在 |
| 3 | pnpm install | 装前端依赖 | `--frozen-lockfile`，锁文件必须与 package.json 同步 |
| 4 | tauri-apps/tauri-action@v0 | 构建 + 发 Release | 前端 Vite 构建 → cargo release 编译 → NSIS 打包 → 创建 **Draft** Release（`releaseDraft: true`）→ 上传 `Kairos_x.y.z_x64-setup.exe`；`tagName: v__VERSION__` 中的 VERSION 取自 `tauri.conf.json`；输出 `releaseUploadUrl`（形如 `https://uploads.github.com/.../assets{?name,label}`）供后续步骤使用 |
| 5 | Package portable zip | 打便携包 | 从 `target/release/` 找 `kairos.exe`（带回退路径）+ 同层 `resources/`，压成 `Kairos_x.y.z_x64-portable.zip` |
| 6 | Upload portable zip | 传便携包 | 把上传 URL 的 `{?name,label}` 模板替换成 `?name=<文件名>` 后 POST；**此步骤当前有 bug，见 §6** |

**权限**：`contents: write`（用内置 `GITHUB_TOKEN` 即可，无需配置 PAT）。

## 5. 已知坑

- **LibreHardwareMonitor 不入 git**：CI 构建时下载（资产名见 §4），本地开发需手动放置到 `src-tauri/resources/`。
- **wmi crate 0.17 的 API**：是 `COMLibrary`（不是 COMLib），且 `WMIConnection::new(com)` / `with_namespace_path(path, com)` 都必须传入 COMLibrary 实例。
- **QQ 音乐 VIP**：免费 128k 无需登录；VIP 需要用户贴 y.qq.com 的 cookie（`uin` + `qm_keyst`），凭据存本机应用数据目录。
- **翻译**：Google 免费端点，无 key，检测语言与目标一致时自动反向（en↔zh）。

## 6. v0.3.1 发布事故复盘（已修复）

**现象**：tag `v0.3.1` 的 run（[35491202105](https://github.com/Everett406/kairos/actions/runs/35491202105)）failure；Draft v0.3.1 只有 `setup.exe`，缺 `portable.zip`。构建、NSIS 上传、便携包压缩全部成功，失败精确落在最后一步「Upload portable zip to draft release」。

**根因**：上传步骤这样读取文件名：

```powershell
$name = (Get-Content $env:GITHUB_OUTPUT | Where-Object { $_ -like 'name=*' }) -replace '^name=', ''
```

但 **`$env:GITHUB_OUTPUT` 是每个 step 独立的临时文件**——上一步「Package portable zip」写入的 `name=...` 在当前步骤里读不到，`$name` 恒为空 → 上传 URL 变成 `?name=`（空）→ GitHub 返回 `422 "Invalid name for request"`（日志原文已核实）。次要因素：打包步骤没有声明 `id:`，即使想用 `steps.<id>.outputs.name` 也无从引用。

**修复预案（二选一，已采用 B）：**

- **A. 最小改动**：给打包步骤加 `id: package`，上传步骤改为 `$name = "${{ steps.package.outputs.name }}"`。
- **B. 直接取本地名（已采用，`230fddd`）**：上传步骤里本来就用 `Get-ChildItem -Filter "*portable.zip"` 拿到了文件，把 `$name` 改成 `$zip.Name`，并删掉两步里的 `GITHUB_OUTPUT` 读写——少一个间接层，永不复发。

**✅ 已修复并验证（2026-09-20）**：删除旧 Draft（避免 setup.exe 同名冲突）后，`workflow_dispatch`（ref=rebuild）重建，run [35493299085](https://github.com/Everett406/kairos/actions/runs/35493299085) 全绿；新 Draft（id 392332159）同时含 `Kairos_0.3.1_x64-setup.exe`（7.5 MB）与 `Kairos_0.3.1_x64-portable.zip`（8.8 MB）。后续发新版无需再删 Draft。

## 7. 提交身份规范

- **统一署名**：`Everett406 <Everett406@users.noreply.github.com>`。克隆后先配好（配 repo 级，别污染全局）：

```bash
git config user.name "Everett406"
git config user.email "Everett406@users.noreply.github.com"
```

- **历史说明**：仓库历史上存在两种署名并存——fork 之前是上游作者的提交；fork 当日的重构 / 重设计两次提交也挂了 `At210Co60` 身份（此前开发环境身份配置不一致所致），`c61ce9a` 起为 `Everett406`。旧提交不做改写，此后一律按上面的配置提交。

## 8. 设计系统（改样式前先看这里）

三层结构，组件**只允许引用 semantic 层**：

```
tokens.css      原子值：灰阶 / 蓝阶 / 间距 / 字号 / 圆角 / 阴影 / 动效
theme-*.css     语义映射：表面 / 文字 / 描边 / 状态色 / 玻璃参数 / 背景氛围光
                + [data-mod='xxx'] 六个模块主题色（--k-mod 组）
                + v4 图表三色 --k-chart-cpu/gpu/mem 与琥珀 --k-warm 组
primitives.css  基础组件样式：k-card / k-btn / k-field / k-tag / k-empty
shell.css       v4 外壳全套样式（src/shell/）：标题栏 / 主画布 / 抽屉 / 面板 / 命令条 / 专注场景
```

- **v0.4「Quiet Instrument」视觉语言**：磨砂窗体（body 半透深空底，真实窗口由 Windows acrylic 模糊壁纸；浏览器预览用 `html.browser-preview` 实底兜底）、低饱和三色曲线 + 琥珀强调、发丝线玻璃卡、克制动效（150–280ms：数字滚动 / 抽屉弹簧滑入 / 弹窗缩放淡入）。
- 功能面板（`FeaturePanel.tsx`）与监控 / 天气弹窗通过 `data-mod` 注入模块色；主画布指标卡直接用 `--k-chart-*`。
- **已知坑**：`backdrop-filter` 元素的后代里，`position: fixed` 会被劫持为该元素的包含块 —— Modal 必须挂在带 backdrop-filter 的容器外面（FeaturePanel 内已有注释）。
- 亮色主题 `theme-light.css` 结构一致，但 v4 外壳（shell.css）未做亮色映射，启用前需补齐（视觉稿 v4 帧六「晨雾」已定稿）。

## 9. 通信边界与数据层约定

- 前端与 Rust 只通过 **16 个显式 command + 2 个事件**（`clipboard-changed`、`global-cmd` 全局热键转发）通信，唯一入口 `src/lib/bridge.ts`。别绕过它直接 `invoke`。
- 全局热键链路：Rust 侧 `tauri-plugin-global-shortcut` 注册 Ctrl+Alt+K → show + focus 主窗口 → `app.emit("global-cmd")` → App.tsx 监听后开关命令条。快捷键本身不占用 capabilities 权限（纯 Rust 侧消费）。
- `bridge.ts` 内置浏览器 mock 层：非 Tauri 环境（`window.__TAURI_INTERNALS__` 不存在）自动走 `mock.ts` 假数据，main.tsx 同时给 html 加 `browser-preview` 类。这是为了浏览器预览 / 截图流水线，桌面上零影响。
- 模块数据 hook 做了**模块级共享缓存 + 共享轮询**（如系统监控 2s 轮询），`useMonitor` 另导出无 React 的 `onStats(fn)` 供历史缓冲（`history.ts`）直接订阅，避免 mock 同引用跳变更。
- 番茄钟状态在 `usePomodoro.ts` 全局单例（专注场景 / 功能面板 / 命令条共享同一份计时），专注会话以 `{s,e}` 落 localStorage（`kairos.pomodoro.sessions`），主画布时间带如实渲染当日会话；其余持久化走 Rust 侧 `store.rs`（JSON 原子写）。

## 10. 目录速查

| 路径 | 内容 |
| --- | --- |
| `src/design/` | 设计 token 三层 + primitives.tsx 组件 |
| `src/shell/` | v4 外壳：Titlebar / MainCanvas / Drawer / FeaturePanel / CommandBar / FocusScene / Modal + shell.css |
| `src/features/<mod>/` | 每模块：`*Panel.tsx` + `api.ts` + `use*.ts` + `model.ts` + `*.css` |
| `src/lib/` | bridge（IPC + mock）、format、charts（自绘 SVG 图表） |
| `src-tauri/src/` | commands/（weather / system / music / clipboard / translate）+ lib.rs（插件注册 / 全局热键） |
| `docs/screenshots/` | 7 张界面截图（v0.4 实拍） |
| `.github/workflows/release.yml` | 发布流水线 |

## 11. 截图流水线（复现方式）

```bash
pnpm dev                                    # 起 Vite（5173）
node shot.mjs                               # playwright-core 无头截图（脚本未入库，临时生成）
# 产出 docs/screenshots/01~07.png；mock 层保证纯浏览器可渲染
```

## 12. 后续可做（按优先级）

1. v0.4.0 人工验收：真机跑一遍（acrylic 磨砂 / 全局热键 / 命令条），Draft 转正式
2. 呼吸边条：屏幕右缘独立置顶小窗（触边滑出 / 可钉住，视觉稿 v4 帧五）
3. 亮色主题「晨雾」：shell.css 语义映射（视觉稿 v4 帧六已定稿）
4. 设置页：热键自定义 / 开机自启 / 刷新频率 / 磨砂浓度
5. housekeeping：移除已不用的 gsap 依赖（需同步重生成 pnpm-lock）
6. 音乐：播放队列持久化、桌面歌词；天气：桌面通知细分开关

## 13. 网络环境备注（开发机）

国内访问 GitHub 不稳定时的经验：用 `dns.alidns.com/resolve` 查 `github.com` / `api.github.com` 真实 IP 写 `/etc/hosts`（github.com→20.205.243.166、api.github.com→140.82.113.6 曾有效，IP 会变需重查）。Actions 日志存在 Azure Blob，直连不通可用平台侧网络拉签名 URL。
