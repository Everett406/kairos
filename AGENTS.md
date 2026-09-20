# AGENTS.md — AI 协作者指南

> 给在本仓库里干活的 AI / 新协作者：读完这份再动手。更深的历史与交接细节见 [HANDOFF.md](HANDOFF.md)，产品面貌见 [README.md](README.md)。

## 🚨 并发协作协议（2026-09-20 起生效，动手前必读）

本仓库当前有**多个 AI 协作者并行工作**。为避免互相覆盖，以下不是建议，是规则：

**铁律**
- **禁止 force push**（`--force` / `--force-with-lease`）rebuild 与 main，任何情况下都不行。
- **推送被拒（non-fast-forward）= 远端已有并发提交**，这是正常信号，不是错误。处理：`git pull --rebase origin rebuild` 之后再推。禁止用强推「解决」。
- **rebase / merge 出冲突时一律保留双方改动**：别人的新增文件全留（不许删）；共享文件（README.md / HANDOFF.md / package.json 等）两边编辑都保留，逐段合并。
- 收尾合并 main 照旧 `git checkout main && git merge rebuild -X theirs`——`-X theirs` 只影响冲突行的取舍，不会删文件，对本协议安全。

**文件属地**：以下文件 2026-09-20 由协作方建立，**不要删除、不要覆盖**；确有冲突（比如想换图标）先问用户：
- `AGENTS.md`（本文件）、`项目建议.md`
- `docs/branding/`（图标源文件）、`public/favicon.svg`、`src-tauri/icons/`（应用图标全套）
- `index.html` 的 favicon link、`shell.css` 的 `.titlebar__logo` 图标样式

你可以增补自己的约定到本文件，但**保留本节原样**。

## 图标收尾（需在开发机本地执行一次）

新图标的 SVG 源文件与引用接线已入库（`docs/branding/*.svg`、`public/favicon.svg`、`index.html` favicon link、`shell.css` 的 `.titlebar__logo`），但 **PNG/ICO 二进制没法走当时的推送通道**——`src-tauri/icons/` 里可能还是旧图标。接手时执行一次：

```bash
# 1. 把 kairos-icon-1024.png（透明底 1024×1024，用户手上有，见聊天交付物）放进 docs/branding/
# 2. 重新生成全套图标（默认写入 src-tauri/icons/）
pnpm tauri icon docs/branding/kairos-icon-1024.png
# 3. 若生成了 android/ 或 ios/ 子目录，删掉（本项目只做 Windows）
# 4. 提交
git add src-tauri/icons docs/branding/kairos-icon-1024.png
git commit -m "assets: 新品牌图标全套（透明底）"
```

注意：`tauri icon` 只接受 PNG 输入（不支持 SVG），SVG 源文件仅作设计留档与 favicon 使用。

## 这是什么

Kairos（καιρός，「恰逢其时的那一刻」）：常驻 Windows 桌面的磨砂质感系统仪表。Tauri 2（Rust）+ React 19 + TypeScript + Vite 7。单窗口、无边框、acrylic 磨砂、全局热键 Ctrl+Alt+K 呼出命令条。无账号、无云、数据全在本机。

## 跑起来

```bash
pnpm install
pnpm dev            # 纯浏览器预览（bridge.ts 内置 mock 层，UI 可脱离桌面壳渲染）
pnpm tauri dev      # 真实桌面调试（需 Rust stable + Windows 10 1809+ / WebView2）
pnpm build          # 前端构建（tsc -b && vite build），提交前必须过
pnpm lint           # oxlint，提交前必须过（当前基线：0 error，少量 warning）
pnpm tauri build    # 本地出包
```

验证基线：`pnpm build` 与 `pnpm lint` 全绿是改动的最低门槛。本项目无测试套件，改纯函数（如 `parse_lrc` / `parse_cookie` / `format.ts`）时优先用脑子过边界，别引入测试框架除非用户要求。

## 架构铁律（别违反）

1. **IPC 唯一入口 `src/lib/bridge.ts`**。前端与 Rust 只通过显式注册的 command（清单见 `src-tauri/src/lib.rs` 的 `invoke_handler`，会随版本增长，以代码为准）+ 少量事件通信。新增能力 = Rust 加 command + bridge 透传，**禁止**在前端组件里直接 `invoke` / `listen`。
2. **mock 层神圣不可缺**。`src/lib/mock.ts` 覆盖每一个 command——`pnpm dev` 浏览器预览和截图流水线全靠它。新增 command 必须同步加 mock 分支，否则截图流程当场崩。
3. **设计三层结构**：`tokens.css`（原子值）→ `theme-*.css`（语义映射，含 `data-mod` 模块色）→ `primitives.css` / `shell.css`（组件）。组件只允许引用 semantic 层变量，禁止硬编码色值。
4. **单例 ticker + 订阅集合**是本项目的状态管理模式（见 `useMonitor.ts`、`usePomodoro.ts`）：模块级共享轮询/计时，组件只是订阅者。新增长驻数据流沿用这个模式，别引 Redux/Zustand。
5. **持久化两轨**：小数据走 Rust 侧 `store.rs`（JSON 原子写）；番茄钟会话等纯 UI 数据走 localStorage（`kairos.*` 前缀）。不引数据库。
6. **克制的依赖**：不引 UI 组件库、不引重型动效库（gsap 是遗留死依赖，待删）。图表用自绘 SVG（`src/lib/charts.tsx`）。

## 硬纪律（用户钦定，违反 = 这轮白干）

- **版本只动末位**：0.4.0 → 0.4.1，minor/major 不许动，除非先获用户明确批准。改版本**四处同步**（package.json / tauri.conf.json / Cargo.toml / Cargo.lock），自检命令见 HANDOFF §3。tag 必须与 tauri.conf.json 的 version 一致。
- **每轮收尾三件套**：README.md、HANDOFF.md、docs/screenshots/ 同步更新后才提交。截图流程见 HANDOFF §2（`pnpm dev` + 1180×760 视口，截图文件名保持稳定，数量随界面形态增长）。
- **Draft-first**：CI 出的 Release 永远停在草稿，用户验收批准前不转正式。
- **提交身份**：`Everett406 <Everett406@users.noreply.github.com>`（repo 级配置，别污染全局）。
- **分支**：开发提交在 `rebuild`，收尾时合并进 `main`（`git merge rebuild -X theirs`）。

## 已知坑（踩过的，别再踩）

- LibreHardwareMonitor 不入 git，CI 构建时下载（资产名 `LibreHardwareMonitor.zip`）；本地开发手动放到 `src-tauri/resources/`。
- wmi crate 0.17：是 `COMLibrary`，`WMIConnection::new(com)` / `with_namespace_path(path, com)` 都要传实例。
- `backdrop-filter` 会劫持后代的 `position: fixed`：Modal 必须挂在带 backdrop-filter 的容器**外面**。
- 全局热键自 v0.4.1 起为运行时注册（`set_hotkeys` 录制式改键，失败返回 Err 不再 panic）；改动键逻辑时注意保持「失败可降级、不炸应用」。
- 纯垂直/水平的 SVG path 配 objectBoundingBox 渐变不渲染（bbox 退化），图标/图形里别这么写。

## 目录速查

| 路径 | 内容 |
| --- | --- |
| `src/design/` | 设计 token 三层 + primitives 组件 |
| `src/shell/` | v4 外壳：Titlebar / MainCanvas / Drawer / FeaturePanel / CommandBar / FocusScene / Modal |
| `src/features/<mod>/` | 每模块：Panel + api + use*.ts + model + css（monitor / weather / music / clipboard / pomodoro / translate） |
| `src/lib/` | bridge（IPC + mock）、charts、format |
| `src-tauri/src/commands/` | weather / system / music / clipboard / translate |
| `.github/workflows/release.yml` | 发布流水线（tag v* 或手动触发，约 12 分钟出 NSIS + 便携 zip） |

## 改代码时的口味

- 动效 150–280ms，克制；图表保留真实毛刺，不做假平滑、不造假数据。
- UI 文案中文、简短、不卖萌；代码注释中文，说明「为什么」而非「是什么」。
- 报错文案给人看（如「该歌曲可能需要 QQ 音乐 VIP——登录后可播」），别抛裸英文异常。
- 做完一件事顺手把它在 HANDOFF §12 的清单里划掉或补上。
