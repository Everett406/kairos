# Kairos

常驻 Windows 桌面的卡片式小组件面板。六张卡片以网格排布，点开任意卡片即以 GSAP FLIP 动画展开为全屏详情；界面基于一套两级设计 token（primitive → semantic），换肤只需替换一份语义映射文件。

基于 **Tauri 2 + React 19 + TypeScript** 重写，安装包为 NSIS 单文件，体积 10 MB 级。

## 功能

| 模块 | 功能 |
| --- | --- |
| 天气 | Open-Meteo 预报（当前 / 24h 降水 / 15 日）、中国 AQI（HJ 633-2012）、城市搜索与 IP 自动定位、日出日落、穿衣建议、降雨 / 紫外线 / 降温预警通知，30 分钟自动刷新 |
| 系统 | CPU / 内存 / GPU / 网速实时监控、磁盘分组容量与忙碌度；以管理员运行时经 LibreHardwareMonitor 读取温度、风扇、内存规格 |
| 番茄钟 | 专注 / 短休 / 长休三模式、时长自定义、环形进度、完成通知、每日统计（数据存本地） |
| 音乐 | QQ 音乐搜索、播放（免费 128k，贴 cookie 登录后可播 VIP）、同步歌词高亮（QQ LRC → LRCLIB 两级来源）、全局播放条 |
| 剪贴板 | 后台监听历史（去重置顶、上限 100 条）、点击回填复制、单条删除与清空 |
| 翻译 | Google 免费端点、8 种目标语言、防抖自动翻译、检测语言与目标一致时自动反向 |

## 权限说明

- **默认运行**：天气 / 音乐 / 剪贴板 / 翻译 / 番茄钟全部可用；系统模块显示占用但无温度。
- **管理员模式**：系统卡片内一键 UAC 提权重启，解锁温度 / 风扇 / 磁盘忙碌度（安装包随附 LibreHardwareMonitor，首次提权自动拉起）。
- **音乐 VIP**：展开音乐卡片 → 登录 → 粘贴 y.qq.com 完整 cookie（含 `uin` 与 `qm_keyst`）。凭据仅保存在本机应用数据目录。

## 开发

```bash
pnpm install
pnpm tauri dev      # 开发调试
pnpm tauri build    # 本地出包
```

要求：Node 22+、pnpm 10、Rust stable、Windows 10 1809+。

## 发布

推送 `v*` tag（如 `git tag v0.3.0 && git push origin v0.3.0`），GitHub Actions 自动构建 NSIS 安装包并创建 Draft Release；LibreHardwareMonitor 在 CI 中下载随包分发，不入 git。

## 架构

```
src/
  design/     设计 token：tokens.css(primitive) → theme-*.css(semantic) → primitives.tsx(组件)
  app/        外壳：标题栏、模块卡片（FLIP 展开收起）
  features/   六个功能模块，各自独立目录（model/api/hook/Panel/css）
  lib/        bridge.ts(IPC 唯一入口)、format.ts
src-tauri/
  commands/   weather / system / music / clipboard / translate
  store.rs    JSON 持久化（原子写）
```

前端与 Rust 之间只通过 16 个显式命令与 1 个事件（`clipboard-changed`）通信。
