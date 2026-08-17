Write-Host '=== src/data exists? ==='
if (Test-Path 'C:\Users\qifeng\Desktop\Waybound\src\data') {
    Get-ChildItem 'C:\Users\qifeng\Desktop\Waybound\src\data' | ForEach-Object { $_.Name }
} else { Write-Host 'NO src/data folder' }
Write-Host '=== doc/spec files in repo root + src (excluding node_modules/.git) ==='
Get-ChildItem -Path 'C:\Users\qifeng\Desktop\Waybound' -Recurse -Depth 2 -Include *.md,*.mdx,*.txt -Exclude node_modules,'.git' 2>$null | Where-Object { $_.FullName -notmatch 'node_modules' } | ForEach-Object { $_.FullName.Replace('C:\Users\qifeng\Desktop\Waybound\','') }
Write-Host '=== TODO/FIXME in src ==='
Get-ChildItem -Path 'C:\Users\qifeng\Desktop\Waybound\src' -Recurse -Include *.ts,*.tsx 2>$null | ForEach-Object { Select-String -Path $_.FullName -Pattern 'TODO|FIXME|BUG|HACK' -CaseSensitive:$false } | Select-Object -First 30

