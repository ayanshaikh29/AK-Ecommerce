$hkSource = "C:\Users\HP\Desktop\Portfolios Ayan\E-COMMERCE WEB\ak-enterprises-website\Hk folder\Hk folder"
$stationarySource = "C:\Users\HP\Desktop\Portfolios Ayan\E-COMMERCE WEB\ak-enterprises-website\stationary\stationary"
$dest = "C:\Users\HP\Desktop\Portfolios Ayan\E-COMMERCE WEB\ak-enterprises-website\public\uploads"

function Clean-Filename($name) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $ext = [System.IO.Path]::GetExtension($name)
    $base = $base -replace ' - Copy( \(\d+\))?', ''
    $base = $base -replace '\(copy\)', ''
    $base = $base -replace '\s+', ' '
    $base = $base.Trim()
    $slug = $base.ToLower() -replace '[^a-z0-9]+', '-'
    return $slug + $ext
}

Get-ChildItem $hkSource | ForEach-Object {
    $clean = Clean-Filename $_.Name
    Copy-Item $_.FullName (Join-Path $dest $clean) -Force
    Write-Host "HK: $($_.Name) -> $clean"
}

Get-ChildItem $stationarySource | ForEach-Object {
    $clean = Clean-Filename $_.Name
    Copy-Item $_.FullName (Join-Path $dest $clean) -Force
    Write-Host "STATIONARY: $($_.Name) -> $clean"
}

Write-Host "`nDone! Files copied to $dest"
