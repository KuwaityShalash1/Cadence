$ErrorActionPreference = "Stop"
$src = "src\components\icon-map.tsx"
$lines = Get-Content $src

$start = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^function inheritCssDeclarations') { $start = $i; break }
}
if ($start -lt 0) { throw "start marker 'function inheritCssDeclarations' not found" }

$fnStart = -1
for ($i = $start; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^export function sanitizeSvgIcon\(') { $fnStart = $i; break }
}
if ($fnStart -lt 0) { throw "sanitizeSvgIcon not found after start marker" }

$depth = 0
$end = -1
for ($i = $fnStart; $i -lt $lines.Count; $i++) {
    $depth += ([regex]::Matches($lines[$i], '\{')).Count
    $depth -= ([regex]::Matches($lines[$i], '\}')).Count
    if ($depth -eq 0 -and $i -gt $fnStart) { $end = $i; break }
}
if ($end -lt 0) { throw "could not find end of sanitizeSvgIcon" }

$block = $lines[$start..$end] -join "`n"
$block = $block -replace '(?m)^export ', ''

# Assertions so we never test the wrong thing
if ($block -notmatch 'function inheritCssDeclarations') { throw "ASSERT FAIL: inheritCssDeclarations missing" }
if ($block -notmatch 'export function sanitizeSvgIcon' -and $block -notmatch 'function sanitizeSvgIcon') { throw "ASSERT FAIL: sanitizeSvgIcon missing" }
if ($block -notmatch 'currentColor') { throw "ASSERT FAIL: currentColor logic missing" }
if ($block -notmatch 'viewBox') { throw "ASSERT FAIL: viewBox logic missing" }

Write-Host "extracted icon-map.tsx lines $($start+1)-$($end+1) ($($block -split "`n").Count lines)"

$body = Get-Content ".svgprobe\body.mjs" -Raw
if ($body -notmatch [regex]::Escape('// __FUNCS__')) { throw "ASSERT FAIL: body placeholder missing" }
$out = $body.Replace('// __FUNCS__', $block)
Set-Content ".svgprobe\probe.ts" -Value $out -Encoding utf8
Write-Host "wrote .svgprobe\probe.ts"
