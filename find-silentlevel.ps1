# 扫描所有常见自启动位置，查找 SilentLevel 相关项
# 用法：在 PowerShell 里运行  .\find-silentlevel.ps1
# 如需查找其它名字，改下面的 $Keyword

$Keyword = 'SilentLevel'

$Found = New-Object System.Collections.Generic.List[object]

function Add-Hit($Source, $Name, $Value) {
    $Found.Add([pscustomobject]@{
        Source = $Source
        Name   = $Name
        Value  = $Value
    })
}

Write-Host "==> 扫描注册表 Run / RunOnce ..." -ForegroundColor Cyan
$RegPaths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnceEx',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
    'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon',
    'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Windows',
    'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows'
)
foreach ($p in $RegPaths) {
    if (Test-Path $p) {
        try {
            $item = Get-ItemProperty -Path $p -ErrorAction Stop
            $item.PSObject.Properties | Where-Object {
                $_.Name -notlike 'PS*' -and "$($_.Value)" -match $Keyword
            } | ForEach-Object {
                Add-Hit "Registry: $p" $_.Name $_.Value
            }
        } catch {}
    }
}

Write-Host "==> 扫描启动文件夹 ..." -ForegroundColor Cyan
$StartupDirs = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
)
foreach ($d in $StartupDirs) {
    if (Test-Path $d) {
        Get-ChildItem -Path $d -Force -ErrorAction SilentlyContinue | ForEach-Object {
            $hit = $false
            if ($_.Name -match $Keyword) { $hit = $true }
            if ($_.Extension -in '.lnk','.url','.bat','.cmd','.vbs','.ps1','.js') {
                try {
                    $content = Get-Content $_.FullName -Raw -ErrorAction Stop
                    if ($content -match $Keyword) { $hit = $true }
                } catch {}
                # .lnk 还要解析 target
                if ($_.Extension -eq '.lnk') {
                    try {
                        $sh = New-Object -ComObject WScript.Shell
                        $lnk = $sh.CreateShortcut($_.FullName)
                        if ($lnk.TargetPath -match $Keyword -or $lnk.Arguments -match $Keyword) {
                            Add-Hit "Startup folder (lnk target)" $_.FullName "$($lnk.TargetPath) $($lnk.Arguments)"
                            $hit = $false  # 已经记录
                        }
                    } catch {}
                }
            }
            if ($hit) { Add-Hit "Startup folder" $_.Name $_.FullName }
        }
    }
}

Write-Host "==> 扫描计划任务（可能较慢）..." -ForegroundColor Cyan
try {
    $tasks = Get-ScheduledTask -ErrorAction Stop
    foreach ($t in $tasks) {
        $actionsText = ($t.Actions | ForEach-Object {
            "$($_.Execute) $($_.Arguments) $($_.WorkingDirectory)"
        }) -join ' | '
        if ($t.TaskName -match $Keyword -or $actionsText -match $Keyword) {
            Add-Hit "ScheduledTask" "$($t.TaskPath)$($t.TaskName)" $actionsText
        }
    }
} catch {
    Write-Warning "Get-ScheduledTask 失败: $_"
}

Write-Host "==> 扫描服务 ..." -ForegroundColor Cyan
try {
    Get-CimInstance Win32_Service -ErrorAction Stop | ForEach-Object {
        if ($_.Name -match $Keyword -or $_.DisplayName -match $Keyword -or $_.PathName -match $Keyword) {
            Add-Hit "Service" $_.Name "$($_.DisplayName) -- $($_.PathName)"
        }
    }
} catch {}

Write-Host "==> 扫描 WMI 永久订阅（恶意软件常用）..." -ForegroundColor Cyan
try {
    Get-CimInstance -Namespace root\subscription -ClassName __EventConsumer -ErrorAction SilentlyContinue | ForEach-Object {
        $dump = ($_ | Format-List * | Out-String)
        if ($dump -match $Keyword) {
            Add-Hit "WMI EventConsumer" $_.Name $dump.Substring(0, [Math]::Min(300,$dump.Length))
        }
    }
} catch {}

Write-Host "==> 扫描当前正在运行的进程 ..." -ForegroundColor Cyan
try {
    Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object {
        if ($_.Name -match $Keyword -or "$($_.CommandLine)" -match $Keyword -or "$($_.ExecutablePath)" -match $Keyword) {
            Add-Hit "Running Process (PID $($_.ProcessId))" $_.Name "$($_.ExecutablePath) | $($_.CommandLine)"
        }
    }
} catch {}

Write-Host "==> 扫描事件日志近 7 天的 Sysmon / 进程创建记录（如有）..." -ForegroundColor Cyan
try {
    Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; Id=1; StartTime=(Get-Date).AddDays(-7)} -ErrorAction Stop |
        Where-Object { $_.Message -match $Keyword } |
        Select-Object -First 5 |
        ForEach-Object { Add-Hit "Sysmon Event" $_.TimeCreated ($_.Message.Substring(0, [Math]::Min(400,$_.Message.Length))) }
} catch {
    # Sysmon 没装就跳过
}
try {
    Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4688; StartTime=(Get-Date).AddDays(-2)} -MaxEvents 2000 -ErrorAction Stop |
        Where-Object { $_.Message -match $Keyword } |
        Select-Object -First 5 |
        ForEach-Object { Add-Hit "Security 4688" $_.TimeCreated ($_.Message.Substring(0, [Math]::Min(400,$_.Message.Length))) }
} catch {}

Write-Host ""
Write-Host "================ 扫描完成 ================" -ForegroundColor Green
if ($Found.Count -eq 0) {
    Write-Host "未在以上位置找到 '$Keyword' 相关项。" -ForegroundColor Yellow
    Write-Host "建议手工再看一下："
    Write-Host "  1. 任务管理器 > 启动 选项卡"
    Write-Host "  2. Autoruns (sysinternals) — 最权威"
    Write-Host "  3. 浏览器扩展 / 浏览器启动项"
} else {
    Write-Host "共找到 $($Found.Count) 条匹配：`n"
    $Found | Format-List Source, Name, Value
    $out = "$env:USERPROFILE\Desktop\silentlevel-scan.txt"
    $Found | Format-List Source, Name, Value | Out-File -FilePath $out -Encoding utf8
    Write-Host "`n结果已保存到: $out" -ForegroundColor Green
}
