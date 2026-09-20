//! 系统监控：单一命令返回全部指标，内部三条数据源
//! 1. sysinfo：CPU 占用/频率、内存、磁盘分区、网速（跨平台）
//! 2. WMI（仅 Windows，需提权）：LibreHardwareMonitor 传感器的温度/风扇、
//!    内存条规格、物理盘→分区关联、磁盘忙碌%
//! 3. nvidia-smi 常驻子进程（后台线程）：NVIDIA GPU 全套
//!
//! 温度/风扇依赖外部 LibreHardwareMonitor（安装包随包分发）：
//! 提权 + LHM 未运行时自动拉起；未提权时相关字段返回 null，前端显示占位。

use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use sysinfo::{Disks, Networks, System};

// ===== 共享状态 =====

pub struct SystemState {
    sys: Mutex<System>,
    nets: Mutex<Networks>,
    last_net: Mutex<Option<(u64, u64, Instant)>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GpuSample {
    util: f64,
    temp: f64,
    mem_used: f64,
    mem_total: f64,
    mem_clock: f64,
    core_clock: f64,
}

impl SystemState {
    pub fn new() -> Arc<Self> {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        Arc::new(Self {
            sys: Mutex::new(sys),
            nets: Mutex::new(Networks::new_with_refreshed_list()),
            last_net: Mutex::new(None),
        })
    }
}

// ===== nvidia-smi 常驻采集线程 =====

/// `nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,clocks.mem,clocks.gr --format=csv,noheader,nounits -l 1`
/// 每秒输出一行 "62, 45, 1200, 8192, 4001, 2505"。进程退出后隔 5s 重拉。
pub fn spawn_gpu_watcher() {
    std::thread::spawn(|| loop {
        let Ok(mut child) = std::process::Command::new("nvidia-smi")
            .args([
                "--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,clocks.mem,clocks.gr",
                "--format=csv,noheader,nounits",
                "-l",
                "1",
            ])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
        else {
            std::thread::sleep(std::time::Duration::from_secs(15));
            continue;
        };
        if let Some(out) = child.stdout.take() {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(out);
            for line in reader.lines().flatten() {
                let parts: Vec<f64> = line
                    .split(',')
                    .filter_map(|v| v.trim().parse::<f64>().ok())
                    .collect();
                if parts.len() >= 6 {
                    let sample = GpuSample {
                        util: parts[0],
                        temp: parts[1],
                        mem_used: parts[2],
                        mem_total: parts[3],
                        mem_clock: parts[4],
                        core_clock: parts[5],
                    };
                    // 写入全局（通过临时 State 不行——线程里没有 State，改用全局静态）
                    GPU_LATEST.lock().unwrap().replace(sample);
                }
            }
        }
        let _ = child.wait();
        // 无 NVIDIA 显卡的机器 nvidia-smi 直接不存在，放慢重试节奏
        std::thread::sleep(std::time::Duration::from_secs(10));
    });
}

static GPU_LATEST: std::sync::Mutex<Option<GpuSample>> = std::sync::Mutex::new(None);

// ===== Windows 专属：提权检测 / LHM / WMI 查询 =====

#[cfg(windows)]
mod win {
    use serde::Deserialize;

    /// 当前进程是否以管理员运行
    pub fn is_elevated() -> bool {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::Security::{
            GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
        };
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
        unsafe {
            let mut token = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
                return false;
            }
            let mut elev = TOKEN_ELEVATION::default();
            let mut ret_len = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elev as *mut _ as *mut _),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut ret_len,
            )
            .is_ok();
            let _ = windows::Win32::Foundation::CloseHandle(token);
            ok && elev.TokenIsElevated != 0
        }
    }

    /// UAC 弹窗提权重启自身（成功后退出当前进程）
    pub fn elevate_and_restart() -> Result<(), String> {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let file: Vec<u16> = exe.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let verb: Vec<u16> = "runas\0".encode_utf16().collect();
        let ret = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(file.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if ret.0 as isize <= 32 {
            return Err("提权被取消或失败".into());
        }
        std::process::exit(0);
    }

    use std::os::windows::ffi::OsStrExt;

    /// LibreHardwareMonitor 拉起标记（一次会话只试一次）
    static LHM_TRIED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

    fn com_con() -> Result<wmi::WMIConnection, String> {
        let com = wmi::COMLibrary::new().map_err(|e| format!("WMI 初始化失败：{e}"))?;
        wmi::WMIConnection::new(com).map_err(|e| format!("WMI 连接失败：{e}"))
    }

    fn lhm_con() -> Result<wmi::WMIConnection, String> {
        let com = wmi::COMLibrary::new().map_err(|e| format!("WMI 初始化失败：{e}"))?;
        wmi::WMIConnection::with_namespace_path("ROOT\\LibreHardwareMonitor", com)
            .map_err(|e| format!("LHM 命名空间不可用：{e}"))
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "PascalCase")]
    pub struct Sensor {
        pub name: String,
        pub sensor_type: String,
        pub value: Option<f64>,
        #[serde(default)]
        pub parent: Option<String>,
    }

    /// 确保 LHM 在运行：提权 + 命名空间无传感器时，启动随包分发的 LHM
    pub fn ensure_lhm() {
        use tauri::Manager;
        if LHM_TRIED.swap(true, std::sync::atomic::Ordering::Relaxed) {
            return;
        }
        if let Ok(con) = lhm_con() {
            let sensors: Result<Vec<Sensor>, _> = con.raw_query("SELECT Name FROM Sensor");
            if matches!(sensors, Ok(list) if !list.is_empty()) {
                return; // LHM 已在跑
            }
        }
        let Some(app) = crate::APP_HANDLE.get() else { return };
        let Ok(exe) = app.path().resolve(
            "resources/LibreHardwareMonitor/LibreHardwareMonitor.exe",
            tauri::path::BaseDirectory::Resource,
        ) else {
            return;
        };
        if exe.exists() {
            let _ = std::process::Command::new(&exe)
                .arg("/minimized")
                .current_dir(exe.parent().unwrap_or(&exe))
                .spawn();
            // 给 LHM 一点初始化时间，下一次 stats 调用即可读到
            std::thread::sleep(std::time::Duration::from_millis(1500));
        }
    }

    /// LHM 传感器：CPU 温度 / CPU 风扇 / GPU 风扇 / 磁盘温度（按 Parent 前缀 /hdd/NN）
    pub fn lhm_readings() -> (Option<f64>, Option<f64>, Option<f64>, std::collections::HashMap<u32, f64>) {
        let mut cpu_temp = None;
        let mut fan_cpu = None;
        let mut fan_gpu = None;
        let mut disk_temps = std::collections::HashMap::new();
        let Ok(con) = lhm_con() else { return (cpu_temp, fan_cpu, fan_gpu, disk_temps) };
        let Ok(sensors) = con.raw_query::<Sensor>("SELECT Name,SensorType,Value,Parent FROM Sensor") else {
            return (cpu_temp, fan_cpu, fan_gpu, disk_temps);
        };
        for s in sensors {
            let v = s.value.unwrap_or(0.0);
            let name_lc = s.name.to_lowercase();
            match s.sensor_type.as_str() {
                "Temperature" => {
                    let parent = s.parent.as_deref().unwrap_or("");
                    if let Some(rest) = parent.strip_prefix("/hdd/") {
                        if let Ok(idx) = rest.split('/').next().unwrap_or("").parse::<u32>() {
                            disk_temps.entry(idx).or_insert(v.round());
                        }
                    } else if cpu_temp.is_none()
                        && parent.starts_with("/cpu")
                        && (name_lc.contains("package") || name_lc.contains("tdie") || name_lc.contains("ccd") || name_lc.contains("core"))
                    {
                        cpu_temp = Some((v * 10.0).round() / 10.0);
                    }
                }
                "Fan" => {
                    if name_lc.contains("gpu") {
                        if fan_gpu.is_none() { fan_gpu = Some(v.round()); }
                    } else if fan_cpu.is_none() {
                        fan_cpu = Some(v.round());
                    }
                }
                _ => {}
            }
        }
        (cpu_temp, fan_cpu, fan_gpu, disk_temps)
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct PhysicalMemory {
        #[serde(default)]
        capacity: String,
        #[serde(default)]
        speed: u32,
        #[serde(default)]
        configured_clock_speed: Option<u32>,
        #[serde(default)]
        smbios_memory_type: u16,
    }

    /// 内存规格摘要："DDR5-5600 · 2×16GB"
    pub fn mem_info() -> Option<String> {
        let con = com_con().ok()?;
        let dimms: Vec<PhysicalMemory> = con
            .raw_query("SELECT Capacity,Speed,ConfiguredClockSpeed,SMBIOSMemoryType FROM Win32_PhysicalMemory")
            .ok()?;
        let dimms: Vec<&PhysicalMemory> = dimms.iter().filter(|d| d.capacity.parse::<u64>().unwrap_or(0) > 0).collect();
        let first = dimms.first()?;
        let type_name = match first.smbios_memory_type {
            34 => "DDR5",
            26 => "DDR4",
            24 => "DDR3",
            _ => "",
        };
        let clock = first.configured_clock_speed.or(Some(first.speed)).filter(|c| *c > 0);
        let mut parts: Vec<String> = Vec::new();
        match (type_name.is_empty(), clock) {
            (false, Some(c)) => parts.push(format!("{type_name}-{c}")),
            (false, None) => parts.push(type_name.into()),
            (true, Some(c)) => parts.push(format!("{c} MHz")),
            (true, None) => {}
        }
        let gb = first.capacity.parse::<u64>().unwrap_or(0) / (1024 * 1024 * 1024);
        parts.push(format!("{}×{}GB", dimms.len(), gb));
        Some(parts.join(" · "))
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct DiskDrive {
        index: u32,
        model: String,
        #[serde(default)]
        size: Option<String>,
    }

    fn ref_key(path: &str, marker: &str) -> Option<String> {
        let start = path.find(marker)? + marker.len();
        let rest = &path[start..];
        let end = rest.find('"')?;
        Some(rest[..end].replace('\\', ""))
    }

    /// 物理盘 → 盘符分组（WMI 三表关联），返回 (model, sizeGB, index, letters)
    pub fn disk_groups() -> Vec<(String, u64, u32, Vec<String>)> {
        let con = match com_con() { Ok(c) => c, Err(_) => return vec![] };
        let drives: Vec<DiskDrive> = match con.raw_query("SELECT Index,Model,Size FROM Win32_DiskDrive") { Ok(d) => d, Err(_) => return vec![] };
        #[derive(Deserialize)]
        #[serde(rename_all = "PascalCase")]
        struct Link { antecedent: String, dependent: String }

        let links1: Vec<Link> = con.raw_query("SELECT Antecedent,Dependent FROM Win32_DiskDriveToDiskPartition").unwrap_or_default();
        let links2: Vec<Link> = con.raw_query("SELECT Antecedent,Dependent FROM Win32_LogicalDiskToPartition").unwrap_or_default();

        // partition key: "Disk #0, Partition #1"
        let part_of = |path: &str| ref_key(path, "Win32_DiskPartition.DeviceID=\"");

        // drive index → partitions
        let mut drive_parts: std::collections::HashMap<u32, Vec<String>> = std::collections::HashMap::new();
        for l in links1 {
            if let Some(drive_ref) = ref_key(&l.antecedent, "Win32_DiskDrive.DeviceID=\"") {
                let idx: Option<u32> = drive_ref
                    .rsplit("PHYSICALDRIVE")
                    .next()
                    .and_then(|s| s.parse().ok());
                if let (Some(idx), Some(part)) = (idx, part_of(&l.dependent)) {
                    drive_parts.entry(idx).or_default().push(part);
                }
            }
        }
        // partition → letters
        let mut part_letters: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
        for l in links2 {
            if let (Some(part), Some(letter_ref)) = (part_of(&l.antecedent), ref_key(&l.dependent, "Win32_LogicalDisk.DeviceID=\"")) {
                part_letters.entry(part).or_default().push(letter_ref);
            }
        }

        drives
            .into_iter()
            .map(|d| {
                let mut letters: Vec<String> = drive_parts
                    .get(&d.index)
                    .map(|parts| {
                        parts
                            .iter()
                            .filter_map(|p| part_letters.get(p))
                            .flatten()
                            .cloned()
                            .collect()
                    })
                    .unwrap_or_default();
                letters.sort();
                letters.dedup();
                (d.model, d.size.and_then(|s| s.parse().ok()).unwrap_or(0), d.index, letters)
            })
            .filter(|(_, _, _, ls)| !ls.is_empty())
            .collect()
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct PerfDisk {
        name: String,
        #[serde(default)]
        percent_disk_time: Option<u32>,
    }

    /// 物理盘忙碌%（Win32_PerfFormattedData_PerfDisk_PhysicalDisk，Name 首段为盘 index）
    pub fn disk_busy() -> std::collections::HashMap<u32, u32> {
        let con = match com_con() { Ok(c) => c, Err(_) => return Default::default() };
        let rows: Vec<PerfDisk> = con
            .raw_query("SELECT Name,PercentDiskTime FROM Win32_PerfFormattedData_PerfDisk_PhysicalDisk")
            .unwrap_or_default();
        rows.into_iter()
            .filter_map(|r| {
                let idx: u32 = r.name.split(' ').next()?.parse().ok()?;
                Some((idx, r.percent_disk_time.unwrap_or(0).min(100)))
            })
            .collect()
    }
}

// ===== 主命令：一次返回全部指标 =====

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub elevated: bool,
    pub cpu: f64,
    pub cpu_name: Option<String>,
    pub cpu_freq_ghz: Option<f64>,
    pub cpu_temp: Option<f64>,
    pub fan_cpu: Option<f64>,
    pub mem_used: f64,
    pub mem_total: f64,
    pub mem_info: Option<String>,
    pub disks: Vec<DiskGroup>,
    pub net_down: f64,
    pub net_up: f64,
    pub gpu: Option<GpuInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskGroup {
    pub model: String,
    pub letters: String,
    pub size_gb: u64,
    pub used_gb: u64,
    pub total_gb: u64,
    pub volumes: Vec<Volume>,
    pub busy_pct: Option<u32>,
    pub temp: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    pub letter: String,
    pub used_gb: u64,
    pub total_gb: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: Option<String>,
    pub util: Option<f64>,
    pub temp: Option<f64>,
    pub mem_used: Option<f64>,
    pub mem_total: Option<f64>,
    pub mem_clock: Option<f64>,
    pub core_clock: Option<f64>,
    pub fan: Option<f64>,
}

const GB: u64 = 1024 * 1024 * 1024;

fn r1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

#[tauri::command]
pub fn system_stats(state: tauri::State<'_, Arc<SystemState>>) -> Result<Stats, String> {
    // CPU + 内存（sysinfo）
    let (cpu, freq_mhz, mem_used, mem_total) = {
        let mut sys = state.sys.lock().unwrap();
        sys.refresh_specifics(
            sysinfo::RefreshKind::default()
                .with_cpu(sysinfo::CpuRefreshKind::default().with_cpu_usage().with_frequency())
                .with_memory(sysinfo::MemoryRefreshKind::default().with_ram()),
        );
        let cpu = sys.global_cpu_usage() as f64;
        let freq = sys.cpus().first().map(|c| c.frequency()).unwrap_or(0);
        let mem_used = sys.used_memory() as f64;
        let mem_total = sys.total_memory() as f64;
        (cpu, freq, mem_used, mem_total)
    };

    // 网络：增量 / 间隔
    let (net_down, net_up) = {
        let mut nets = state.nets.lock().unwrap();
        nets.refresh(true);
        let mut rx = 0u64;
        let mut tx = 0u64;
        for (_name, data) in nets.iter() {
            rx += data.received();
            tx += data.transmitted();
        }
        let now = Instant::now();
        let rate = {
            let last = *state.last_net.lock().unwrap();
            match last {
                Some((prx, ptx, at)) => {
                    let dt = now.duration_since(at).as_secs_f64().max(0.001);
                    (
                        rx.saturating_sub(prx) as f64 / dt / 1_048_576.0,
                        tx.saturating_sub(ptx) as f64 / dt / 1_048_576.0,
                    )
                }
                None => (0.0, 0.0),
            }
        };
        *state.last_net.lock().unwrap() = Some((rx, tx, now));
        rate
    };

    let mut stats = Stats {
        elevated: false,
        cpu: r1(cpu),
        cpu_name: None,
        cpu_freq_ghz: if freq_mhz > 0 { Some((freq_mhz as f64 / 1000.0 * 100.0).round() / 100.0) } else { None },
        cpu_temp: None,
        fan_cpu: None,
        mem_used: r1(mem_used / GB as f64),
        mem_total: r1(mem_total / GB as f64),
        mem_info: None,
        disks: vec![],
        net_down: r1(net_down),
        net_up: r1(net_up),
        gpu: None,
    };

    // sysinfo 磁盘分区（跨平台兜底：无 WMI 时按分区直出）
    let volumes: std::collections::HashMap<String, (u64, u64)> = Disks::new_with_refreshed_list()
        .list()
        .iter()
        .filter_map(|d| {
            let letter = d.mount_point().to_string_lossy().trim_end_matches('\\').to_uppercase();
            let letter = letter.rsplit(['\\', '/']).next()?.to_string();
            if letter.len() != 2 || !letter.ends_with(':') { return None; }
            Some((letter, (d.total_space(), d.total_space() - d.available_space())))
        })
        .collect();

    #[cfg(windows)]
    {
        stats.elevated = win::is_elevated();
        stats.cpu_name = {
            let sys = state.sys.lock().unwrap();
            sys.cpus().first().map(|c| c.brand().trim().to_string()).filter(|s| !s.is_empty())
        };
        stats.mem_info = win::mem_info();

        // GPU（nvidia-smi 线程 + LHM 风扇兜底）
        if let Some(g) = GPU_LATEST.lock().unwrap().clone() {
            stats.gpu = Some(GpuInfo {
                name: None,
                util: Some(g.util),
                temp: Some(g.temp),
                mem_used: Some(g.mem_used),
                mem_total: Some(g.mem_total),
                mem_clock: Some(g.mem_clock),
                core_clock: Some(g.core_clock),
                fan: None,
            });
        }

        if stats.elevated {
            win::ensure_lhm();
            let (cpu_temp, fan_cpu, fan_gpu, disk_temps) = win::lhm_readings();
            stats.cpu_temp = cpu_temp;
            stats.fan_cpu = fan_cpu;
            if let Some(g) = stats.gpu.as_mut() {
                g.fan = fan_gpu;
            }
            let busy = win::disk_busy();
            let groups = win::disk_groups();
            stats.disks = groups
                .into_iter()
                .map(|(model, size_bytes, index, letters)| {
                    let mut total = 0u64;
                    let mut used = 0u64;
                    let mut vols = vec![];
                    for l in &letters {
                        if let Some((t, u)) = volumes.get(&format!("{l}:")) {
                            total += *t;
                            used += *u;
                            vols.push(Volume { letter: l.clone(), used_gb: u / GB, total_gb: t / GB });
                        }
                    }
                    DiskGroup {
                        model,
                        letters: letters.join(", "),
                        size_gb: size_bytes / GB,
                        used_gb: used / GB,
                        total_gb: total / GB,
                        volumes: vols,
                        busy_pct: busy.get(&index).copied(),
                        temp: disk_temps.get(&index).copied(),
                    }
                })
                .collect();
        }
    }

    #[cfg(not(windows))]
    {
        let _ = &volumes;
        stats.cpu_name = {
            let sys = state.sys.lock().unwrap();
            sys.cpus().first().map(|c| c.brand().trim().to_string()).filter(|s| !s.is_empty())
        };
        stats.disks = volumes
            .iter()
            .map(|(letter, (t, u))| DiskGroup {
                model: letter.clone(),
                letters: letter.trim_end_matches(':').to_string(),
                size_gb: t / GB,
                used_gb: u / GB,
                total_gb: t / GB,
                volumes: vec![Volume { letter: letter.trim_end_matches(':').to_string(), used_gb: u / GB, total_gb: t / GB }],
                busy_pct: None,
                temp: None,
            })
            .collect();
    }

    Ok(stats)
}

/// 明示提权：UAC 弹窗后以管理员重启（仅 Windows）
#[tauri::command]
pub fn system_elevate() -> Result<(), String> {
    #[cfg(windows)]
    return win::elevate_and_restart();
    #[cfg(not(windows))]
    Err("仅 Windows 支持提权".into())
}
