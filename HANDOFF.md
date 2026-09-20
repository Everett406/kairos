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

- **已发布**：v0.3.0（正式，NSIS 安装包 7.5 MB）；v0.3.1 处于 **Draft，双产物已齐**（安装包 7.5 MB + 便携版 8.8 MB），待人工验收后转正式。
- **版本一致性**：`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` 四处均为 `0.3.1`，已核对。
- **CI 运行史**：v0.3.0 两次失败（LHM 资产名 404、wmi API 误用）后修复成功；v0.3.1 败于便携版上传，已修复（§6）并经 dispatch 重建验证成功。
- **文档**：README 为产品主页风；本文档负责工程细节与决策记录。

## 2. 版本纪律（硬约束）

- **只动最后一位**：版本号保持 `0.3.x`，发版一律 patch 递增（0.3.1 → 0.3.2 → 0.3.3…）。**不主动升 minor / major**，除非明确做出架构级决策并记录在案。
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
primitives.css  基础组件样式：k-card / k-btn / k-field / k-tag / k-empty
```

- 每张卡片通过 `ModuleCard.tsx` 的 `data-mod={mod.id}` 注入主题色，图标芯片、悬停光晕、进度条、焦点态全部跟随 `--k-mod` 系列变量。新增模块时在 `theme-dark.css` 加一组 `[data-mod]` 即可。
- 视觉语言：「Aurora Glass」——深空蓝底（`#0a0e17`）+ 三团彩色氛围光（蓝 / 紫 / 暖橙）+ SVG 噪点压 banding + 渐变玻璃卡片（顶部 1px 内高光）。
- 亮色主题 `theme-light.css` 结构与暗色一致，但尚未覆盖 `[data-mod]` 之外的最新变量（如 `--k-glow-*`），启用前需补齐。

## 9. 通信边界与数据层约定

- 前端与 Rust 只通过 **16 个显式 command + 1 个事件**（`clipboard-changed`）通信，唯一入口 `src/lib/bridge.ts`。别绕过它直接 `invoke`。
- `bridge.ts` 内置浏览器 mock 层：非 Tauri 环境（`window.__TAURI_INTERNALS__` 不存在）自动走 `mock.ts` 假数据。这是为了浏览器预览 / 截图流水线，桌面上零影响。
- 模块数据 hook 做了**模块级共享缓存 + 共享轮询**（如系统监控 2s 轮询），因为卡片展开 / 收起是实例卸载重建，不做共享会重复请求。
- 番茄钟用**时间戳倒计时**（`endAtRef`）防 interval 漂移；每日计数存 localStorage（`kairos.pomodoro.*`）；其余持久化走 Rust 侧 `store.rs`（JSON 原子写）。

## 10. 目录速查

| 路径 | 内容 |
| --- | --- |
| `src/design/` | 设计 token 三层 + primitives.tsx 组件 |
| `src/app/` | Titlebar / ModuleCard（FLIP）/ 外壳样式 |
| `src/features/<mod>/` | 每模块：`*Panel.tsx` + `api.ts` + `use*.ts` + `model.ts` + `*.css` |
| `src/lib/` | bridge（IPC + mock）、format |
| `src-tauri/src/commands/` | weather / system / music / clipboard / translate |
| `docs/screenshots/` | 7 张界面截图（playwright + mock 层自动生成） |
| `.github/workflows/release.yml` | 发布流水线 |

## 11. 截图流水线（复现方式）

```bash
pnpm dev                                    # 起 Vite（5173）
node shot.mjs                               # playwright-core 无头截图（脚本未入库，临时生成）
# 产出 docs/screenshots/01~07.png；mock 层保证纯浏览器可渲染
```

## 12. 后续可做（按优先级）

1. v0.3.1 人工验收后转正式（Draft 双产物已齐，见 §6）
2. UI 舒适度打磨：整体看着舒服、设计合理（进行中议题，待细化）
3. 亮色主题补齐新 token（`--k-glow-*`、`[data-mod]` 组）
4. 设置页（主题切换 / 开机自启 / 刷新频率）
5. 音乐：播放队列持久化、桌面歌词；天气：桌面通知细分开关
6. 卡片布局自定义（拖拽排序 / 隐藏模块）

## 13. 网络环境备注（开发机）

国内访问 GitHub 不稳定时的经验：用 `dns.alidns.com/resolve` 查 `github.com` / `api.github.com` 真实 IP 写 `/etc/hosts`（github.com→20.205.243.166、api.github.com→140.82.113.6 曾有效，IP 会变需重查）。Actions 日志存在 Azure Blob，直连不通可用平台侧网络拉签名 URL。
