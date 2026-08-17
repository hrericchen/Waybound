$f = Get-Content $args[0]
$start = [int]$args[1]
$end = [int]$args[2]
for ($i = $start; $i -le $end; $i++) {
    $line = $f[$i - 1]
    Write-Output ("{0,4} | {1}" -f $i, $line)
}

