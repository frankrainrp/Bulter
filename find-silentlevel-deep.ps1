# 深度查找 SilentLevel.exe 的释放者（loader/dropper）
# 已知：开机时尝试从 C:\Users\asus\AppData\Local\Temp\<随机名>\SilentLevel.exe 启动
# 推测：某个加载器开机时自解压到 Temp，本脚本要找到这个加载器

$Keyword = 'SilentLevel'
$Out = [System.Collections.Generic.List[object]]::new()

function Hit($cat, $where, $detail) {
    $o = [pscustomobject]@{ Category=$cat; Where=$where; Detail=$detail }
    $Out.Add($o)
    Write-Host "[HIT] $cat :: $where" -ForegroundColor Yellow
    Write-Host "       $detail" -ForegroundColor DarkYellow
}

# ---------- 1. 非常规注册表持久化位置 ----------
Write-Host "==> [1/5] 检查非常规注册表持久化点 ..." -ForegroundColor Cyan
$ExtraKeys = @(
    'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Image File Execution Options',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows NT\CurrentVersion\Image File Execution Options',
    'HKLM:\Software\Microsoft\Active Setup\Installed Components',
    'HKCU:\Software\Microsoft\Active Setup\Installed Components',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\ShellServiceObjectDelayLoad',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\SharedTaskScheduler',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\Browser Helper Objects',
    'HKLM:\Software\Classes\Protocols\Filter',
    'HKLM:\Software\Classes\Protocols\Handler',
    'HKLM:\System\CurrentControlSet\Control\Session Manager',
    'HKCU:\Environment',
    'HKLM:\System\CurrentControlSet\Control\Session Manager\Environment'
)
foreach ($root in $ExtraKeys) {
    if (-not (Test-Path $root)) { continue }
    try {
        Get-ChildItem -Path $root -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $props = Get-ItemProperty -Path $_.PSPath -ErrorAction Stop
                $props.PSObject.Properties | Where-Object {
                    $_.Name -notlike 'PS*' -and "$($_.Value)" -match $Keyword
                } | ForEach-Object {
                    Hit "Registry-extra" "$($props.PSPath) :: $($_.Name)" "$($_.Value)"
                }
            } catch {}
        }
        $top = Get-ItemProperty -Path $root -ErrorAction SilentlyContinue
        if ($top) {
            $top.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' -and "$($_.Value)" -match $Keyword } |
                ForEach-Object { Hit "Registry-extra" "$root :: $($_.Name)" "$($_.Value)" }
        }
    } catch {}
}

# Winlogon Userinit / Shell
$wl = Get-ItemProperty 'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
if ($wl) {
    foreach ($n in 'Userinit','Shell','Taskman','VMApplet','AppSetup') {
        if ($wl.$n) {
            Write-Host "  Winlogon\$n = $($wl.$n)" -ForegroundColor Gray
            if ("$($wl.$n)" -match $Keyword) { Hit "Winlogon" $n $wl.$n }
        }
    }
}

# ---------- 2. 用户启动文件夹再次细查 ----------
Write-Host "==> [2/5] 扫描启动目录里所有快捷方式的目标 ..." -ForegroundColor Cyan
$StartupDirs = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
)
$sh = New-Object -ComObject WScript.Shell
foreach ($d in $StartupDirs) {
    if (-not (Test-Path $d)) { continue }
    Get-ChildItem -Path $d -Force -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  [startup item] $($_.Name)" -ForegroundColor Gray
        if ($_.Extension -eq '.lnk') {
            try {
                $lnk = $sh.CreateShortcut($_.FullName)
                Write-Host "      -> $($lnk.TargetPath) $($lnk.Arguments)" -ForegroundColor DarkGray
                if ("$($lnk.TargetPath) $($lnk.Arguments)" -match $Keyword) {
                    Hit "Startup-lnk" $_.FullName "$($lnk.TargetPath) $($lnk.Arguments)"
                }
            } catch {}
        }
    }
}

# ---------- 3. 全盘搜索文件名 ----------
Write-Host "==> [3/5] 搜索硬盘上所有名为 SilentLevel* 的文件（C:/D:）..." -ForegroundColor Cyan
$searchRoots = @('C:\','D:\')
foreach ($root in $searchRoots) {
    if (-not (Test-Path $root)) { continue }
    Write-Host "  searching $root ..." -ForegroundColor Gray
    try {
        Get-ChildItem -Path $root -Filter "*$Keyword*" -Recurse -Force -ErrorAction SilentlyContinue |
            Select-Object -First 50 |
            ForEach-Object {
                Hit "FileName" $_.FullName "Length=$($_.Length) LastWrite=$($_.LastWriteTime)"
            }
    } catch {}
}

# ---------- 4. 全盘 grep：找哪个文件里"提到了" SilentLevel ----------
Write-Host "==> [4/5] 在常见加载器/安装器/脚本目录里 grep 'SilentLevel'（可能要几分钟）..." -ForegroundColor Cyan
$grepRoots = @(
    "$env:LOCALAPPDATA",
    "$env:APPDATA",
    "$env:ProgramData",
    "$env:USERPROFILE\Documents",
    "$env:USERPROFILE\Downloads",
    'C:\Program Files',
    'C:\Program Files (x86)'
)
$exts = @('.exe','.dll','.bat','.cmd','.ps1','.vbs','.js','.lnk','.ini','.cfg','.xml','.json','.txt','.log')
foreach ($r in $grepRoots) {
    if (-not (Test-Path $r)) { continue }
    Write-Host "  grep in $r ..." -ForegroundColor Gray
    try {
        Get-ChildItem -Path $r -Recurse -Force -ErrorAction SilentlyContinue -File |
            Where-Object { $_.Length -lt 50MB -and $exts -contains $_.Extension.ToLower() } |
            ForEach-Object {
                try {
                    # 对二进制和文本都做字节级搜索
                    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
                    $asAscii = [System.Text.Encoding]::ASCII.GetString($bytes)
                    $asUni   = [System.Text.Encoding]::Unicode.GetString($bytes)
                    if ($asAscii -match $Keyword -or $asUni -match $Keyword) {
                        Hit "FileContent" $_.FullName "size=$($_.Length) ext=$($_.Extension)"
                    }
                } catch {}
            }
    } catch {}
}

# ---------- 5. 看 Temp 残留 ----------
Write-Host "==> [5/5] 检查 Temp 里残留的自解压目录 ..." -ForegroundColor Cyan
$tmp = $env:TEMP
if (Test-Path $tmp) {
    Get-ChildItem -Path $tmp -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^[a-z0-9]{10,20}$' } |
        ForEach-Object {
            $contents = Get-ChildItem -Path $_.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 5 -ExpandProperty Name
            Write-Host "  Temp\$($_.Name)  ($($_.LastWriteTime)) -> $($contents -join ', ')" -ForegroundColor Gray
            if ($_.Name -eq 'yt1qsfq89wth3bav' -or ($contents -join ' ') -match $Keyword) {
                Hit "Temp-residue" $_.FullName ($contents -join ', ')
            }
        }
}

# ---------- 输出 ----------
Write-Host "`n========== 完成 ==========" -ForegroundColor Green
$out = "$([Environment]::GetFolderPath('Desktop'))\silentlevel-deep-scan.txt"
if (-not (Test-Path (Split-Path $out -Parent))) {
    $out = "D:\User\asus\Desktop\silentlevel-deep-scan.txt"
}
if ($Out.Count -eq 0) {
    Write-Host "仍然没找到任何与 '$Keyword' 直接相关的文件或注册表项。" -ForegroundColor Yellow
    Write-Host "下一步建议：用 Microsoft Sysinternals Autoruns 看（最全），或者打开 Process Monitor 抓开机时的进程创建。"
} else {
    Write-Host "共 $($Out.Count) 条命中：`n"
    $Out | Format-List
    $Out | Format-List | Out-File -FilePath $out -Encoding utf8
    Write-Host "已写到: $out" -ForegroundColor Green
}
