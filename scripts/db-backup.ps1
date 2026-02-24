$ErrorActionPreference = 'Stop'

$backupDir = [string]$env:GOOGLE_DRIVE_BACKUP_DIR
if ([string]::IsNullOrWhiteSpace($backupDir)) {
  throw 'GOOGLE_DRIVE_BACKUP_DIR is not set'
}

$dbUrl = [string]$env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
  throw 'SUPABASE_DB_URL is not set'
}

$retentionDaysRaw = [string]$env:BACKUP_RETENTION_DAYS
$retentionDays = 14
if (-not [string]::IsNullOrWhiteSpace($retentionDaysRaw)) {
  [int]$retentionDays = $retentionDaysRaw
}

$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue)
if (-not $pgDump) {
  throw 'pg_dump not found in PATH'
}

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outFile = Join-Path $backupDir ("supabase_backup_${stamp}.dump")

& $pgDump.Source $dbUrl --format=c --no-owner --no-acl --file $outFile

$cutoff = (Get-Date).AddDays(-1 * $retentionDays)
Get-ChildItem -Path $backupDir -Filter 'supabase_backup_*.dump' -File |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force

Write-Output ("OK: backup created: {0}" -f $outFile)
