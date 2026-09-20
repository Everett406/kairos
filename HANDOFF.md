# Kairos 交接文档（HANDOFF）

> 最后更新：2026-09-20 · v0.4.1 · 读者：下一个接手的人、未来的自己、协助开发的 AI

## 0. 项目沿革（前世今生）

| 时间 | 事件 |
| --- | --- |
| 2026-09-04 | 上游 At210Co60/kairos 建仓，首个提交「Kairos 液态玻璃桌面助手」（Electron + React 19 路线） |
| 2026-09-05 ~ 09-06 | Electron 壳 + 系统硬件监控完善；风扇转速改用 Lenovo Legion Toolkit 同款 WMI 通道 |
| 2026-09-16 | 上游活跃收官：自研 WebGL 折射层、提权改走计划任务、README 重写；`main` 停在 `86f0f87` |
| 2026-09-20 | Fork 至 Everett406/kairos；同日完成 **Tauri 2 全面重构**（`5aa7067`，移除 Electron 双后端、六模块重写、建立设计 token 体系与 CI），修复 LHM 下载 404 与 wmi 0.17 API 两处 CI 问题（`c61ce9a`、`a52c17f`），发布 **v0.3.0** |
| 2026-09-20 | **Aurora Glass UI 重设计** + 便携版支持（`85fcfb0`）→ **v0.3.1**（发布事故见 §7，已修复转正） |
| 2026-09-20 | **v0.4.0「Quiet Instrument」**：UI 按 v4 视觉稿架构级重构（`0aa6a82`）——新外壳（主画布 / 指标抽屉 / 九宫格功能面板 / 全局命令条 / 专注场景）+ 全局热键 Ctrl+Alt+K + acrylic 磨砂窗体；CI 一次全绿，Draft 双产物齐备待用户真机验收。同日确立 **每轮收尾工作流（§2）** 与 **版本只动末位（§3）**、**Draft-first（§4）** 三条纪律 |
| 2026-09-20 | **v0.4.1**（按用户反馈的大迭代）：活动记录时间轴（前台应用采样）+ 设置页（主题/热键/磁贴/音乐源/自启）+ 亮色「晨雾」+ 四套主题色 + 磨砂浓度 + 抽屉加宽每核负载 + 监控进程榜 + 天气重排 + 音乐三源（网易云实测接入 / 本地扫描）+ 剪贴板搜索置顶与全局呼出（Ctrl+Alt+V） |

**分支现状：**

| 分支 | 状态 |
| --- | --- |
| `main` | **主线镜像（默认分支，仓库主页）**：每轮收尾时从 rebuild 合并过来，保证主页 README / 截图 / 代码始终与最新版一致（2026-09-20 起不再是 Electron 存档；Electron 快照仍可在历史 `86f0f87` 考古） |
| `rebuild` | **开发主线**：所有提交、发版都在这里进行 |
| `fix/glass-stability-and-perf` | 上游遗留的 Electron 修复分支，未合入；Tauri 重写后已无实际意义 |

## 1. 当前状态

- **已发布**：v0.3.0 / v0.3.1（均正式）。
- **v0.4.0**：Draft 双产物曾齐备；已被 v0.4.1 取代（未转正，新版发布后可关闭或转正，见 §12 决策点）。
- **v0.4.1（Draft，待用户验收）**：按用户 2026-09-20 反馈清单的大迭代——主画布活动时间轴（Rust 端 5s 前台采样）、设置页（暗/亮主题、四套主题色、磨砂浓度、热键录制、主页磁贴、音乐源、开机自启）、抽屉加宽 + 每核负载柱、监控弹窗进程榜、天气重排（24h 温度曲线 + 15 日范围条）、音乐三源（QQ / 网易云免费曲库 / 本地文件夹）、剪贴板搜索置顶 + Ctrl+Alt+V 全局呼出、番茄钟刻度环打磨。版本四处已同步 `0.4.1`。
- **CI 运行史**：v0.3.x 两次事故均已修复（见 §7）；release.yml 未变，直接复用。
- **文档**：README 产品主页风，界面一览 10 图（新增设置页）；本文档 §2 起载明每轮收尾的强制工作流。

## 2. 每轮收尾工作流（强制，用户钦定）

> **用户纪律（2026-09-20）**：每轮开发结束后，必须同步更新 **README.md、HANDOFF.md、docs/screenshots/** 三件套，然后才提交推送。仓库主页（main）的 README 与截图就是产品的脸面——代码改了而文档没跟上，等于这轮没做完。

> **并发协作（2026-09-20 起）**：rebuild 上可能已有其他协作者的提交（AGENTS.md / 项目建议.md / 新图标全套等）。**推送被拒（non-fast-forward）时先 `git pull --rebase origin rebuild`，保留双方改动后再推，严禁 force push**；冲突时新增文件全留、共享文件两边编辑都保留。完整协议见 AGENTS.md 顶部「并发协作协议」。

按序六步：

**① 版本号**（若本轮发版）：按 §3 纪律**只动末位**，四处同步，并用 §3 的自检命令核对输出一致。

**② 重拍截图** `docs/screenshots/`（文件名保持稳定，README 按名引用，改名必同步 README）：

```bash
pnpm dev          # 起 Vite（5173）；mock 层自动生效，纯浏览器可渲染全部界面
```

用无头浏览器（agent-browser / Playwright / DevTools 设备工具栏均可）以 **1180×760** 视口逐状态截图：

| 文件名 | 状态 | 如何到达 |
| --- | --- | --- |
| 01-home.png | 主画布 | 默认即此 |
| 02-weather.png | 天气弹窗 | 标题栏天气 chip |
| 03-monitor.png | 系统监控弹窗 | 点指标卡开抽屉 →「打开完整系统监控」 |
| 04-pomodoro.png | 番茄钟 | 九宫格 → 番茄钟 |
| 05-music.png | 音乐 | 九宫格 → 音乐（可在设置切源：QQ / 网易云 / 本地） |
| 06-clipboard.png | 剪贴板 | 九宫格 → 剪贴板 |
| 07-translate.png | 翻译 | 九宫格 → 翻译 |
| 08-drawer.png | 指标抽屉 | 点任一指标卡 |
| 09-cmd.png | 全局命令条 | Ctrl+K 或标题栏命令 chip（可输入示例文字让建议列表出现） |
| 10-settings.png | 设置页 | 标题栏齿轮（截「外观」页；热键 / 磁贴 / 音乐页可酌情补拍） |

覆盖后逐张目检：无空数据、无穿帮、无调试痕迹。新增界面形态时按序号新建文件名（如 `10-xxx.png`）并同步进 README「界面一览」。

**③ 更新 README.md**：新功能写进「功能总览」表；「界面一览」与最新截图对齐；用户可见的新问题补进 FAQ；Roadmap 勾掉已完成项；核对安装表中产物文件名示例等版本相关数字。

**④ 更新 HANDOFF.md（本文档）**：§0 沿革表加一行；§1 当前状态改写；本轮新踩的坑记入 §6 已知坑；§12 后续可做增删。

**⑤ 提交推送**：Everett406 署名（见 §8），在 rebuild 分支提交；随后把 rebuild 合并进 main——`git checkout main && git merge rebuild -X theirs`（冲突一律取 rebuild 侧）再推送，保证主页最新。**若 push 被拒说明有并发提交：`git pull --rebase origin rebuild` 后再推，严禁强推**（见 §2 开头并发协作提示）。

**⑥ 发布**（若本轮发版）：按 §4 流程打 tag → CI 构建 → Draft Release 补 Release Notes → **停在草稿，等用户验收批准后才转正式**。

## 3. 版本纪律（硬约束）

- **只动末位（用户钦定，2026-09-20）**：常规迭代**只递增最后一位**——0.4.0 → 0.4.1 → 0.4.2 ……；**中间位（minor）与首位（major）保持不动**。确有架构级大改需要升位时，必须先向用户说明、获明确批准后才能动。0.3.x → 0.4.0 是唯一一次 minor 升位（v4 外壳架构级重构 + 全局热键 + acrylic 窗体，已获用户追认，下不为例）。
- **改版本号必须四处同步**，漏一处 CI 就会产出错版号的产物：

```bash
# 改完用这条命令自检，四处输出必须一致
grep -E '"version"' package.json src-tauri/tauri.conf.json
grep -E '^version' src-tauri/Cargo.toml
grep -A1 'name = "kairos"' src-tauri/Cargo.lock | grep version
```

- **tag 必须与 `tauri.conf.json` 的 version 一致**：tauri-action 用 `v__VERSION__` 定位 release，两边对不上会建出孤儿草稿。

## 4. 发布流程（标准操作）

```bash
# 1. 同步版本号（四处，见 §3）
# 2. 提交并打 tag
git add -A && git commit -m "..."
git tag v0.4.x
git push origin rebuild v0.4.x
# 3. 等 CI（约 12 分钟）：NSIS + portable zip → Draft Release
# 4. Draft 补写 Release Notes → 停在草稿等用户验收
# 5. 用户批准后，GitHub Release 页手动转正式
```

**Draft-first（用户钦定纪律，2026-09-20）**：任何发布**先出草稿**——CI 产出 Draft Release 后补上 Release Notes，然后停在草稿状态；**用户明确批准后才转正式**，未批准前保持 Draft 不动。这不是流程建议，是硬纪律。

## 5. Action（release.yml）运作详解

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
| 6 | Upload portable zip | 传便携包 | 把上传 URL 的 `{?name,label}` 模板替换成 `?name=<文件名>` 后 POST；v0.3.1 曾在此步出过事故，已修复（见 §7） |

**权限**：`contents: write`（用内置 `GITHUB_TOKEN` 即可，无需配置 PAT）。

## 6. 已知坑

- **LibreHardwareMonitor 不入 git**：CI 构建时下载（资产名见 §5），本地开发需手动放置到 `src-tauri/resources/`。
- **wmi crate 0.17 的 API**：是 `COMLibrary`（不是 COMLib），且 `WMIConnection::new(com)` / `with_namespace_path(path, com)` 都必须传入 COMLibrary 实例。
- **网易云接口（2026-09 实测）**：老搜索 `/api/search/get/web` 已返回加密 hex，**必须走 `/api/cloudsearch/pc`**（POST form：s/type/offset/limit/total，明文 JSON，字段 `ar`/`al`/`dt`/`fee`）；播放走 `/song/media/outer/url?id={id}.mp3` 302 到 CDN（免费歌可播，VIP 歌 302 到 `/404`，以 final_url 判别）；歌词 `/api/song/lyric` 明文。这些是社区公开接口，随时可能再变，坏了先重测。
- **m-cell 内的 .m-bar**：monitor.css 里 `.m-bar { flex: 1 }` 是给横向 flex 行用的；在 flex column 的 `.m-cell` 里会被垂直撑爆，必须用 `.m-cell .m-bar { flex: 0 0 6px }` 钉死（v0.4.1 踩过）。
- **QQ 音乐 VIP**：免费 128k 无需登录；VIP 需要用户贴 y.qq.com 的 cookie（`uin` + `qm_keyst`），凭据存本机应用数据目录。
- **翻译**：Google 免费端点，无 key，检测语言与目标一致时自动反向（en↔zh）。

## 7. v0.3.1 发布事故复盘（已修复）

**现象**：tag `v0.3.1` 的 run（[35491202105](https://github.com/Everett406/kairos/actions/runs/35491202105)）failure；Draft v0.3.1 只有 `setup.exe`，缺 `portable.zip`。构建、NSIS 上传、便携包压缩全部成功，失败精确落在最后一步「Upload portable zip to draft release」。

**根因**：上传步骤这样读取文件名：

```powershell
$name = (Get-Content $env:GITHUB_OUTPUT | Where-Object { $_ -like 'name=*' }) -replace '^name=', ''
```

但 **`$env:GITHUB_OUTPUT` 是每个 step 独立的临时文件**——上一步「Package portable zip」写入的 `name=...` 在当前步骤里读不到，`$name` 恒为空 → 上传 URL 变成 `?name=`（空）→ GitHub 返回 `422 "Invalid name for request"`（日志原文已核实）。次要因素：打包步骤没有声明 `id:`，即使想用 `steps.<id>.outputs.name` 也无从引用。

**修复预案（二选一，已采用 B）：**

- **A. 最小改动**：给打包步骤加 `id: package`，上传步骤改为 `$name = "${{ steps.package.outputs.name }}"`。
- **B. 直接取本地名（已采用，`230fddd`）**：上传步骤里本来就用 `Get-ChildItem -Filter "*portable.zip"` 拿到了文件，把 `$name` 改成 `$zip.Name`，并删掉两步里的 `GITHUB_OUTPUT` 读写——少一个间接层，永不复发。

**✅ 已修复并验证（2026-09-20）**：删除旧 Draft（避免 setup.exe 同名冲突）后，`workflow_dispatch`（ref=rebuild）重建，run [35493299085](https://github.com/Everett406/kairos/actions/runs/35493299085) 全绿；新 Draft 同时含 setup.exe 与 portable.zip。后续发新版无需再删 Draft。

## 8. 提交身份规范

- **统一署名**：`Everett406 <Everett406@users.noreply.github.com>`。克隆后先配好（配 repo 级，别污染全局）：

```bash
git config user.name "Everett406"
git config user.email "Everett406@users.noreply.github.com"
```

- **历史说明**：仓库历史上存在两种署名并存——fork 之前是上游作者的提交；fork 当日的重构 / 重设计两次提交也挂了 `At210Co60` 身份（此前开发环境身份配置不一致所致），`c61ce9a` 起为 `Everett406`。旧提交不做改写，此后一律按上面的配置提交。

## 9. 设计系统（改样式前先看这里）

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
- **已知坑**：`backdrop-filter` 元素的后代里，`position: fixed` 会被劫持为该元素的包含块——Modal 必须挂在带 backdrop-filter 的容器外面（FeaturePanel 内已有注释）。
- **亮色主题「晨雾」v0.4.1 已上线**：theme-light.css 与暗色键完全同构（含 `--k-panel-grad` / `--k-focus-grad` / `--k-body-grad`），强调色预设块置于该文件末尾（利用级联顺序压过主题默认值）；shell.css 末尾有 `:root[data-theme='light']` 修正块（环形轨 / 时间轴轨等白色系玻璃元素）。

## 10. 通信边界与数据层约定

- 前端与 Rust 只通过 **30 个显式 command + 3 个事件**（`clipboard-changed`、全局热键转发 `global-cmd` / `global-clipboard`）通信，唯一入口 `src/lib/bridge.ts`。别绕过它直接 `invoke`。
- 全局热键链路：Rust 侧 `apply_hotkeys`（lib.rs）读设置注册两个热键 → 命令条热键 `app.emit("global-cmd")`、剪贴板热键 `emit("global-clipboard")` → App.tsx 监听开关对应浮层。设置页改键走 `set_hotkeys` 命令即时重注册（先 unregister_all），失败回退默认并报错。
- `bridge.ts` 内置浏览器 mock 层：非 Tauri 环境（`window.__TAURI_INTERNALS__` 不存在）自动走 `mock.ts` 假数据，main.tsx 同时给 html 加 `browser-preview` 类。这是为了浏览器预览 / 截图流水线，桌面上零影响。
- 设置存取：`src/lib/settings.ts` 用 useSyncExternalStore 订阅单键 `settings_get/settings_set`（settings.json）；主题 / 强调色 / 磨砂浓度由 App.tsx 写到 `html[data-theme/data-accent/--k-frost]`，theme-dark.css 的 `--k-body-grad` 用 calc 公式消费。
- 模块数据 hook 做了**模块级共享缓存 + 共享轮询**（如系统监控 2s 轮询），`useMonitor` 另导出无 React 的 `onStats(fn)` 供历史缓冲（`history.ts`）直接订阅，避免 mock 同引用跳变更。进程 Top 单独走 `process_top` 命令（3s，仅监控弹窗打开时），避免拖慢主轮询。
- 番茄钟状态在 `usePomodoro.ts` 全局单例（专注场景 / 功能面板 / 命令条共享同一份计时），专注会话以 `{s,e}` 落 localStorage（`kairos.pomodoro.sessions`），主画布活动时间轴如实渲染当日会话；其余持久化走 Rust 侧 `store.rs`（JSON 原子写）。

## 11. 目录速查

| 路径 | 内容 |
| --- | --- |
| `src/design/` | 设计 token 三层 + primitives.tsx 组件 |
| `src/shell/` | v4 外壳：Titlebar / MainCanvas / Drawer / FeaturePanel / CommandBar / FocusScene / Modal / SettingsScene + shell.css |
| `src/features/<mod>/` | 每模块：`*Panel.tsx` + `api.ts` + `use*.ts` + `model.ts` + `*.css`（activity 只有 api.ts） |
| `src/lib/` | bridge（IPC + mock）、format、charts（自绘 SVG 图表）、settings（设置中心） |
| `src-tauri/src/` | commands/（weather / system / music / clipboard / translate / activity / settings）+ lib.rs（插件注册 / 热键 apply_hotkeys / set_hotkeys） |
| `docs/screenshots/` | 10 张界面截图（v0.4.1 实拍，mock 数据渲染；清单与重拍步骤见 §2） |
| `.github/workflows/release.yml` | 发布流水线 |

## 12. 后续可做（按优先级）

1. v0.4.1 人工验收：真机跑一遍（活动时间轴 / 设置改主题热键 / 网易云播放 / Ctrl+Alt+V），用户批准后 Draft 转正式；v0.4.0 旧 Draft 关闭或删除
2. 音乐：网易云扫码登录（/login/qr 三段接口，接通后 VIP 曲库可播）、本地音乐 ID3 标签与内嵌封面（lofty）、播放队列持久化
3. 主页磁贴：拖拽排序、磁贴尺寸（大 / 中 / 小）自由组合
4. 呼吸边条：屏幕右缘独立置顶小窗（触边滑出 / 可钉住，视觉稿 v4 帧五）
5. 剪贴板：独立小窗形态（脱离主窗口）
6. 设置页补充：采样频率（当前固定 2s）、天气城市管理入口
7. housekeeping：移除已不用的 gsap 依赖（需同步重生成 pnpm-lock）

## 13. 网络环境备注（开发机）

国内访问 GitHub 不稳定时的经验：用 `dns.alidns.com/resolve` 查 `github.com` / `api.github.com` 真实 IP 写 `/etc/hosts`（github.com→20.205.243.166、api.github.com→140.82.113.6 曾有效，IP 会变需重查）。Actions 日志存在 Azure Blob，直连不通可用平台侧网络拉签名 URL。
