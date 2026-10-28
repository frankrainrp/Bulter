# 找谁在开机调 _svc_launch.bat / ServiceApp
$keys = @('_svc_launch','ServiceApp','svc_launch')
$Out = [System.Collections.Generic.List[object]]::new()

function Hit($c,$w,$d){
    $o=[pscustomobject]@{Cat=$c;Where=$w;Detail=$d}; $Out.Add($o)
    Write-Host "[HIT] $c :: $w" -ForegroundColor Yellow
    Write-Host "       $d" -ForegroundColor DarkYellow
}

Write-Host "==> 注册表 Run/RunOnce/Winlogon ..." -ForegroundColor Cyan
$RegPaths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon'
)
foreach($p in $RegPaths){
    if(Test-Path $p){
        $i = Get-ItemProperty $p -ErrorAction SilentlyContinue
        if($i){
            $i.PSObject.Properties | Where-Object {$_.Name -notlike 'PS*'} | ForEach-Object{
                foreach($k in $keys){
                    if("$($_.Value)" -match $k){
                        Hit "Reg" "$p :: $($_.Name)" $_.Value
                    }
                }
            }
        }
    }
}

Write-Host "==> 计划任务 ..." -ForegroundColor Cyan
Get-ScheduledTask -ErrorAction SilentlyContinue | ForEach-Object{
    $t = $_
    $txt = ($t.Actions | ForEach-Object{"$($_.Execute) $($_.Arguments)"}) -join ' | '
    foreach($k in $keys){
        if($t.TaskName -match $k -or $txt -match $k){
            Hit "Task" "$($t.TaskPath)$($t.TaskName)" $txt
        }
    }
}

Write-Host "==> 服务 ..." -ForegroundColor Cyan
Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | ForEach-Object{
    foreach($k in $keys){
        if($_.Name -match $k -or $_.DisplayName -match $k -or $_.PathName -match $k){
            Hit "Svc" $_.Name "$($_.DisplayName) -- $($_.PathName)"
        }
    }
}

Write-Host "==> 启动文件夹快捷方式 target ..." -ForegroundColor Cyan
$sh = New-Object -ComObject WScript.Shell
@("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup") | ForEach-Object{
    if(Test-Path $_){
        Get-ChildItem $_ -Filter *.lnk -Force -ErrorAction SilentlyContinue | ForEach-Object{
            try{
                $l = $sh.CreateShortcut($_.FullName)
                foreach($k in $keys){
                    if("$($l.TargetPath) $($l.Arguments)" -match $k){
                        Hit "Startup-lnk" $_.FullName "$($l.TargetPath) $($l.Arguments)"
                    }
                }
            }catch{}
        }
    }
}

Write-Host "==> grep 启动相关目录里所有 .bat/.cmd/.vbs/.ps1/.xml/.lnk 谁引用 ServiceApp ..." -ForegroundColor Cyan
@("$env:LOCALAPPDATA","$env:APPDATA","$env:ProgramData","$env:windir\System32\Tasks") | ForEach-Object{
    if(Test-Path $_){
        Get-ChildItem $_ -Recurse -Force -ErrorAction SilentlyContinue -File |
            Where-Object{ $_.Length -lt 5MB -and $_.Extension -in '.bat','.cmd','.vbs','.ps1','.xml','.lnk','.ini','.json','.exe','.dll' } |
            ForEach-Object{
                try{
                    $b = [System.IO.File]::ReadAllBytes($_.FullName)
                    $a = [System.Text.Encoding]::ASCII.GetString($b)
                    $u = [System.Text.Encoding]::Unicode.GetString($b)
                    foreach($k in $keys){
                        if($a -match $k -or $u -match $k){
                            Hit "FileRef" $_.FullName "size=$($_.Length)"
                            break
                        }
                    }
                }catch{}
            }
    }
}

Write-Host "`n========== 完成 ==========" -ForegroundColor Green
if($Out.Count -eq 0){
    Write-Host "没找到谁在调它。可能是 Task Scheduler 里某个引用了 cmd.exe + 参数的任务。" -ForegroundColor Yellow
}else{
    Write-Host "$($Out.Count) 条命中：" -ForegroundColor Green
    $Out | Format-List
}
