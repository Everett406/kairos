<div align="center">

# Kairos

**常驻 Windows 桌面的玻璃质感小组件面板**

*Kairos（καιρός），希腊语里「恰逢其时的那一刻」。*

六张卡片卧在一张无边框玻璃面板上——天气、系统监控、番茄钟、音乐、剪贴板、翻译。
点开任意一张，以一段流畅的 FLIP 动效全屏展开。不注册、不上云，数据都留在你自己的电脑里。

[![Release](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FEverett406%2Fkairos%2Freleases&query=%24[0].tag_name&label=release&color=3b6ef5)](https://github.com/Everett406/kairos/releases)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?style=flat-square&logo=windows11&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)

[下载安装](#安装) · [功能总览](#功能总览) · [常见问题](#常见问题-faq) · [参与开发](#开发)

<br>

![Kairos 主面板](docs/screenshots/01-home.png)

</div>

## 为什么是 Kairos

- **六合一，一眼即得** —— 天气 / 系统监控 / 番茄钟 / 音乐 / 剪贴板 / 翻译，桌面常驻、随手可查，点开即全屏展开。
- **轻若无物** —— Tauri 2 + Rust 原生外壳，安装包仅 7.5 MB；还有解压即用的便携版，免安装。
- **Aurora Glass 视觉** —— 深空底色、三团氛围光、噪点质感；渐变玻璃卡片配顶部内高光，六个模块各有专属主题色，悬停即亮。
- **动效讲究** —— GSAP FLIP 驱动的卡片展开 / 收起，从网格到全屏一气呵成，不闪不跳。
- **真·硬件监控** —— 管理员模式下经 LibreHardwareMonitor 读取 CPU / GPU 温度、风扇转速与磁盘忙碌度。
- **数据不出本机** —— 没有账号体系，偏好、历史与凭据全部只存在本地。

## 功能总览

| 模块 | 能做什么 | 主题色 |
| --- | --- | --- |
| ☁️ 天气 | Open-Meteo 预报（当前 / 24h 降水 / 15 日）、中国 AQI（HJ 633-2012）、城市搜索与 IP 自动定位、日出日落、穿衣建议、降雨 / 紫外线 / 降温预警通知，30 分钟自动刷新 | 天蓝 |
| 🖥️ 系统 | CPU / 内存 / GPU / 网速实时监控（2s 轮询）、磁盘分组容量与忙碌度；管理员模式经 LibreHardwareMonitor（WMI 桥）读取温度、风扇、内存规格 | 翠绿 |
| 🍅 番茄钟 | 专注 / 短休 / 长休三模式、时长自定义、环形进度、完成通知、每日统计（数据存本地） | 珊瑚 |
| 🎵 音乐 | QQ 音乐搜索、播放（免费 128k，贴 cookie 登录后可播 VIP）、同步歌词高亮（QQ LRC → LRCLIB 两级来源）、全局播放条（面板切换不断播） | 绛紫 |
| 📋 剪贴板 | 后台监听历史（去重置顶、上限 100 条）、点击回填复制、单条删除与清空 | 琥珀 |
| 🌐 翻译 | Google 免费端点、8 种目标语言、防抖自动翻译、检测语言与目标一致时自动反向 | 青碧 |

## 界面一览

| 天气 · 展开态 | 系统监控 · 展开态 | 番茄钟 |
| --- | --- | --- |
| ![天气](docs/screenshots/02-weather.png) | ![系统](docs/screenshots/03-monitor.png) | ![番茄钟](docs/screenshots/04-pomodoro.png) |

| 音乐 | 剪贴板 | 翻译 |
| --- | --- | --- |
| ![音乐](docs/screenshots/05-music.png) | ![剪贴板](docs/screenshots/06-clipboard.png) | ![翻译](docs/screenshots/07-translate.png) |

## 安装

到 [Releases](https://github.com/Everett406/kairos/releases) 下载对应产物：

| 产物 | 适合谁 | 用法 |
| --- | --- | --- |
| `Kairos_x.y.z_x64-setup.exe` | 大多数用户 | 双击安装，开始菜单启动 |
| `Kairos_x.y.z_x64-portable.zip` | 免安装党 | 解压即用；保持 `Kairos.exe` 与 `resources/` 目录同层 |

> 首次运行若遇 SmartScreen 提示：安装包未做代码签名，点「更多信息 → 仍要运行」即可。

## 使用与权限

- **默认运行**：天气 / 音乐 / 剪贴板 / 翻译 / 番茄钟全部可用；系统模块显示占用但无温度。
- **管理员模式**：系统卡片内一键 UAC 提权重启，解锁温度 / 风扇 / 磁盘忙碌度（安装包随附 LibreHardwareMonitor，首次提权自动拉起）。
- **音乐 VIP**：展开音乐卡片 → 登录 → 粘贴 y.qq.com 完整 cookie（含 `uin` 与 `qm_keyst`）。凭据仅保存在本机应用数据目录。

## 常见问题 FAQ

**Q：系统卡片里看不到温度 / 风扇转速？**
Windows 把传感器接口锁在管理员权限后面。在系统卡片内点「启用」，走一次 UAC 提权重启即可解锁温度、风扇与磁盘忙碌度。

**Q：安装时被 SmartScreen 拦截？**
安装包目前未做代码签名，属于正常现象：点「更多信息 → 仍要运行」。

**Q：VIP 歌曲放不了？**
免费曲目（128k）无需登录可直接播放；VIP 曲目需要你粘贴自己 y.qq.com 的完整 cookie，凭据只存在本机应用数据目录，不会上传。

**Q：便携版和安装版有什么区别？**
功能完全一致。便携版解压即用、不写注册表，唯一要注意的是别把 `Kairos.exe` 和 `resources/` 目录拆开。

## 开发

```bash
pnpm install
pnpm tauri dev      # 开发调试
pnpm tauri build    # 本地出包
pnpm build          # 仅构建前端（Vite 产物）
```

环境要求：Node 22+、pnpm 10、Rust stable、Windows 10 1809+（WebView2 常青版）。

| 层 | 技术 |
| --- | --- |
| 桌面壳 | Tauri 2（Rust），无边框窗口 + 自绘标题栏 |
| 前端 | React 19 + TypeScript + Vite 7 |
| 动效 | GSAP FLIP（卡片展开 / 收起） |
| 图标 | lucide-react + Meteocons（天气） |
| 系统信息 | sysinfo + WMI + LibreHardwareMonitor（Rust 侧） |

前端与 Rust 之间只通过 **16 个显式命令**与 **1 个事件**（`clipboard-changed`）通信，全部经由 `src/lib/bridge.ts` 单点收发；`bridge.ts` 内置浏览器 mock 层，UI 可以脱离桌面壳独立渲染。设计 token、模块约定、已知坑等完整交接细节见 [HANDOFF.md](HANDOFF.md)。

## 发布

推送 `v*` tag（如 `git tag v0.3.1 && git push origin v0.3.1`），GitHub Actions 自动完成构建，约 12 分钟后产出 NSIS 安装包与便携版 zip，并以 **Draft Release** 形式挂出；人工验收无误后手动转正式。

## Roadmap

- [ ] 亮色主题（token 体系已就位，补齐语义映射即可）
- [ ] 设置页：主题切换 / 开机自启 / 刷新频率
- [ ] 卡片布局自定义：拖拽排序、隐藏模块
- [ ] 音乐：播放队列持久化、桌面歌词
- [ ] 天气：预警通知细分开关

## 许可

个人项目，仅供学习交流。
