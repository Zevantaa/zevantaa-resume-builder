[CmdletBinding()]
param(
  [ValidateSet("DryRun", "Release")]
  [string]$Mode = "DryRun",
  [string]$ExpectedCommit = "",
  [string]$EvidenceRoot = "",
  [string]$AuthorizationRecord = "",
  [string]$AuthConfigurationAttestation = "",
  [string]$VercelProjectId = "",
  [switch]$AuthorizeMigrationRepair,
  [switch]$AuthorizeSchemaMigration,
  [switch]$AuthorizeDeployment,
  [switch]$AllowDirtyWorkingTree
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$ExpectedBranch = "feature/premium-uiux-document-upgrade"
$ExpectedRemote = "https://github.com/Zevantaa/zevantaa-resume-builder.git"
$ProductionOrigin = "https://ats.zevantaacareers.com"
$SupabaseProjectRef = "fzltowzpfrnuxxxrzuih"
$SupabaseCli = "supabase@3.1.0"
$VercelCli = "vercel@65.14.0"
$AutomationVersions = @(
  "20261103215458", "20261103220738", "20261103221521",
  "20261103222143", "20261103222518", "20261103223240"
)
$InvitationMigration = "20261111085249"
$RequiredVercelEnvironmentNames = @(
  "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
  "SECURITY_RATE_LIMIT_KEY", "AUTOMATION_WORKER_SECRET"
)
$Results = New-Object System.Collections.Generic.List[object]
$Blockers = New-Object System.Collections.Generic.List[string]
$ReleaseStopped = $false

function Test-PathWithin([string]$Parent, [string]$Candidate) {
  $parentPath = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $candidatePath = [System.IO.Path]::GetFullPath($Candidate)
  return $candidatePath.StartsWith($parentPath, [System.StringComparison]::OrdinalIgnoreCase)
}

if (-not $EvidenceRoot) {
  $EvidenceRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("zevantaa-release-evidence-" + (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))
}
$EvidenceRoot = [System.IO.Path]::GetFullPath($EvidenceRoot)
if (Test-PathWithin $RepositoryRoot $EvidenceRoot) {
  throw "Release evidence and backups must be stored outside the Git repository."
}
if ((Test-Path -LiteralPath $EvidenceRoot) -and (Get-ChildItem -LiteralPath $EvidenceRoot -Force | Select-Object -First 1)) {
  throw "The evidence directory must be new and empty for every release attempt."
}
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null

function Add-Result([string]$Name, [string]$Status, [string]$Summary, [string]$Recovery = "") {
  $Results.Add([pscustomobject]@{
    name = $Name
    status = $Status
    summary = $Summary
    recovery = $Recovery
  })
  Write-Host ("[{0}] {1}: {2}" -f $Status, $Name, $Summary)
  if ($Status -in @("FAIL", "BLOCKED")) {
    $Blockers.Add(("{0}: {1}" -f $Name, $Recovery))
  }
}

function Invoke-External([string]$FilePath, [string[]]$Arguments) {
  $previousPreference = $ErrorActionPreference
  $temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $errorPath = [System.IO.Path]::GetTempFileName()
  $output = ""
  $exitCode = 1
  try {
    $ErrorActionPreference = "Continue"
    $output = & $FilePath @Arguments 2> $errorPath | Out-String
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
    $resolvedErrorPath = [System.IO.Path]::GetFullPath($errorPath)
    if ($resolvedErrorPath.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $resolvedErrorPath)) {
      Remove-Item -LiteralPath $resolvedErrorPath -Force
    }
  }
  if ($exitCode -ne 0) {
    throw "Command failed without completing its release check."
  }
  return $output
}

function Invoke-Check([string]$Name, [scriptblock]$Action, [string]$Recovery) {
  try {
    $summary = & $Action
    if (-not $summary) { $summary = "Verified." }
    Add-Result $Name "PASS" $summary
    return $true
  } catch {
    Add-Result $Name "FAIL" $_.Exception.Message $Recovery
    return $false
  }
}

function Assert-ReleaseCanContinue([string]$Phase) {
  if ($Mode -eq "Release" -and $Blockers.Count -gt 0) {
    $script:ReleaseStopped = $true
    throw "Release stopped after $Phase because a critical prerequisite failed."
  }
}

function Invoke-Supabase([string[]]$Arguments) {
  return Invoke-External "npx.cmd" (@("--yes", $SupabaseCli) + $Arguments)
}

function Invoke-Vercel([string[]]$Arguments) {
  return Invoke-External "npx.cmd" (@("--yes", $VercelCli) + $Arguments)
}

function Get-GitValue([string[]]$Arguments) {
  return (Invoke-External "git" $Arguments).Trim()
}

function Get-JsonPropertyRecursive($Value, [string]$PropertyName) {
  if ($null -eq $Value) { return $null }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    foreach ($item in $Value) {
      $found = Get-JsonPropertyRecursive $item $PropertyName
      if ($null -ne $found) { return $found }
    }
  }
  if ($Value -is [psobject]) {
    $property = $Value.PSObject.Properties[$PropertyName]
    if ($null -ne $property) { return $property.Value }
    foreach ($candidate in $Value.PSObject.Properties) {
      $found = Get-JsonPropertyRecursive $candidate.Value $PropertyName
      if ($null -ne $found) { return $found }
    }
  }
  return $null
}

function Invoke-ReadOnlySql([string]$File, [string]$EvidenceFile) {
  $output = Invoke-Supabase @(
    "--output-format", "json", "db", "query", "--remote=$SupabaseProjectRef",
    "--read-only", "--file", $File
  )
  [System.IO.File]::WriteAllText($EvidenceFile, $output, [System.Text.UTF8Encoding]::new($false))
  return $output
}

function Assert-JsonAttestation([string]$Path, [string[]]$RequiredTrue, [hashtable]$RequiredValues) {
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "A required signed, secret-free attestation file is missing."
  }
  $value = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  foreach ($name in $RequiredTrue) {
    if ($value.$name -ne $true) { throw "Attestation field '$name' is not verified." }
  }
  foreach ($entry in $RequiredValues.GetEnumerator()) {
    if ($value.($entry.Key) -ne $entry.Value) { throw "Attestation target '$($entry.Key)' does not match this release." }
  }
  if (-not $value.checkedBy -or -not $value.checkedAtUtc) { throw "Attestation owner and UTC time are required." }
  return $value
}

function Write-Checksums([string]$Directory) {
  $checksumFile = Join-Path $Directory "checksums.sha256"
  $lines = Get-ChildItem -LiteralPath $Directory -File -Recurse |
    Where-Object { $_.FullName -ne $checksumFile } |
    Sort-Object FullName |
    ForEach-Object {
      $relative = $_.FullName.Substring($Directory.TrimEnd('\').Length + 1).Replace('\', '/')
      "{0}  {1}" -f (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant(), $relative
    }
  [System.IO.File]::WriteAllLines($checksumFile, $lines, [System.Text.UTF8Encoding]::new($false))
  if (-not $lines -or $lines.Count -lt 1) { throw "No backup files were available for checksum evidence." }
  return $checksumFile
}

function New-ProductionBackup {
  $backupRoot = Join-Path $EvidenceRoot "production-backup"
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  Invoke-Supabase @("db", "dump", "--remote=$SupabaseProjectRef", "--role-only", "--file", (Join-Path $backupRoot "roles.sql")) | Out-Null
  Invoke-Supabase @("db", "dump", "--remote=$SupabaseProjectRef", "--file", (Join-Path $backupRoot "schema.sql")) | Out-Null
  Invoke-Supabase @("db", "dump", "--remote=$SupabaseProjectRef", "--data-only", "--use-copy",
    "--exclude", "storage.buckets_vectors", "--exclude", "storage.vector_indexes",
    "--file", (Join-Path $backupRoot "data.sql")) | Out-Null
  Invoke-Supabase @("db", "dump", "--remote=$SupabaseProjectRef", "--schema", "supabase_migrations",
    "--file", (Join-Path $backupRoot "history-schema.sql")) | Out-Null
  Invoke-Supabase @("db", "dump", "--remote=$SupabaseProjectRef", "--schema", "supabase_migrations",
    "--data-only", "--use-copy", "--file", (Join-Path $backupRoot "history-data.sql")) | Out-Null
  $snapshotSql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SNAPSHOT_READ_ONLY.sql"
  $snapshotOutput = Invoke-ReadOnlySql $snapshotSql (Join-Path $backupRoot "source-counts.json")
  $snapshotJson = $snapshotOutput | ConvertFrom-Json
  if ($null -eq (Get-JsonPropertyRecursive $snapshotJson "release_snapshot")) {
    throw "The production count snapshot was not returned in the expected safe format."
  }

  $storageRoot = Join-Path $backupRoot "private-storage"
  $storageOutput = Invoke-External "node" @((Join-Path $RepositoryRoot "scripts\backup-private-storage.mjs"), "--output", $storageRoot)
  $storageSummary = $storageOutput.Trim() | ConvertFrom-Json
  if ($storageSummary.bucketCount -ne 3 -or $storageSummary.objectCount -lt 0) {
    throw "Private Storage backup evidence was incomplete."
  }
  Write-Checksums $backupRoot | Out-Null
  return $backupRoot
}

function Test-IsolatedRestore([string]$BackupRoot) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue) -or -not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop and psql are required for isolated restore validation."
  }
  $restoreRoot = Join-Path $EvidenceRoot "isolated-restore"
  New-Item -ItemType Directory -Path $restoreRoot -Force | Out-Null
  Invoke-Supabase @("init", "--workdir", $restoreRoot) | Out-Null
  $started = $false
  try {
    Invoke-Supabase @("start", "--workdir", $restoreRoot) | Out-Null
    $started = $true
    $status = Invoke-Supabase @("--output", "env", "status", "--workdir", $restoreRoot)
    $statusValues = @{}
    foreach ($line in ($status -split "`r?`n")) {
      if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') { $statusValues[$matches[1]] = $matches[2].TrimEnd('"') }
    }
    foreach ($required in @("DB_URL", "API_URL", "SERVICE_ROLE_KEY")) {
      if (-not $statusValues.ContainsKey($required)) { throw "The isolated Supabase stack did not expose $required." }
    }
    $restoreFiles = @(
      "roles.sql", "schema.sql", "history-schema.sql"
    )
    $psqlArgs = @($statusValues["DB_URL"], "--single-transaction", "--variable", "ON_ERROR_STOP=1")
    foreach ($file in $restoreFiles) { $psqlArgs += @("--file", (Join-Path $BackupRoot $file)) }
    $psqlArgs += @("--command", "SET session_replication_role = replica")
    foreach ($file in @("data.sql", "history-data.sql")) { $psqlArgs += @("--file", (Join-Path $BackupRoot $file)) }
    Invoke-External "psql" $psqlArgs | Out-Null

    $snapshotSql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SNAPSHOT_READ_ONLY.sql"
    $localSnapshotText = Invoke-External "psql" @($statusValues["DB_URL"], "--tuples-only", "--no-align", "--file", $snapshotSql)
    $localSnapshot = ($localSnapshotText.Trim() | ConvertFrom-Json) | ConvertTo-Json -Compress -Depth 20
    $sourceRaw = Get-Content -Raw -LiteralPath (Join-Path $BackupRoot "source-counts.json") | ConvertFrom-Json
    $sourceSnapshot = (Get-JsonPropertyRecursive $sourceRaw "release_snapshot") | ConvertTo-Json -Compress -Depth 20
    if ($localSnapshot -ne $sourceSnapshot) { throw "Isolated database row counts did not match production backup evidence." }

    $previousUrl = $env:ISOLATED_SUPABASE_URL
    $previousKey = $env:ISOLATED_SUPABASE_SECRET_KEY
    $previousRef = $env:ISOLATED_SUPABASE_PROJECT_REF
    try {
      $env:ISOLATED_SUPABASE_URL = $statusValues["API_URL"]
      $env:ISOLATED_SUPABASE_SECRET_KEY = $statusValues["SERVICE_ROLE_KEY"]
      $env:ISOLATED_SUPABASE_PROJECT_REF = "local-isolated-restore"
      $manifest = Join-Path $BackupRoot "private-storage\storage-manifest.json"
      $restoreOutput = Invoke-External "node" @(
        (Join-Path $RepositoryRoot "scripts\restore-private-storage.mjs"),
        "--manifest", $manifest, "--confirm-isolated-target"
      )
      $restored = $restoreOutput.Trim() | ConvertFrom-Json
      $manifestValue = Get-Content -Raw -LiteralPath $manifest | ConvertFrom-Json
      $expectedObjects = ($manifestValue.buckets | Measure-Object -Property objectCount -Sum).Sum
      if ($restored.restoredObjectCount -ne $expectedObjects) { throw "Isolated Storage restore counts did not match the backup manifest." }
    } finally {
      $env:ISOLATED_SUPABASE_URL = $previousUrl
      $env:ISOLATED_SUPABASE_SECRET_KEY = $previousKey
      $env:ISOLATED_SUPABASE_PROJECT_REF = $previousRef
    }
    [System.IO.File]::WriteAllText((Join-Path $restoreRoot "RESTORE-PASSED.txt"),
      ("Isolated database and private Storage restore verified at {0}." -f (Get-Date).ToUniversalTime().ToString("o")),
      [System.Text.UTF8Encoding]::new($false))
  } finally {
    if ($started) { try { Invoke-Supabase @("stop", "--workdir", $restoreRoot) | Out-Null } catch { } }
  }
  return $restoreRoot
}

function Test-AutomationMigrationEquivalence {
  $baselineRoot = Join-Path $EvidenceRoot "automation-migration-equivalence"
  New-Item -ItemType Directory -Path $baselineRoot -Force | Out-Null
  Invoke-Supabase @("init", "--workdir", $baselineRoot) | Out-Null
  $targetMigrations = Join-Path $baselineRoot "supabase\migrations"
  New-Item -ItemType Directory -Path $targetMigrations -Force | Out-Null
  Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "supabase\migrations") -Filter "*.sql" |
    Where-Object { $_.Name -notlike "$InvitationMigration*" } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $targetMigrations }
  $diffPath = Join-Path $baselineRoot "live-vs-automation-baseline.sql"
  Invoke-Supabase @("db", "diff", "--from", "migrations", "--to", $SupabaseProjectRef,
    "--schema", "public", "--strict-coverage", "--output", $diffPath, "--workdir", $baselineRoot) | Out-Null
  $meaningfulDiff = (Get-Content -Raw -LiteralPath $diffPath) -replace '(?m)^\s*--.*$', '' -replace '\s', ''
  if ($meaningfulDiff) { throw "Live public schema differs from the expected state after the six automation migrations." }
  $preflight = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_PREDEPLOYMENT_PREFLIGHT_READ_ONLY.sql"
  Invoke-ReadOnlySql $preflight (Join-Path $baselineRoot "preflight.json") | Out-Null
  return $baselineRoot
}

function Get-RemoteMigrationVersions {
  $historyFile = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_MIGRATION_HISTORY_READ_ONLY.sql"
  $output = Invoke-ReadOnlySql $historyFile (Join-Path $EvidenceRoot "migration-history.json")
  $parsed = $output | ConvertFrom-Json
  $versions = Get-JsonPropertyRecursive $parsed "versions"
  if ($null -eq $versions) { throw "Remote migration history could not be parsed." }
  return @($versions | ForEach-Object { [string]$_ })
}

function Repair-MigrationHistoryIfApproved([string[]]$RemoteVersions) {
  $missing = @($AutomationVersions | Where-Object { $_ -notin $RemoteVersions })
  if ($missing.Count -eq 0) { return "All six automation versions are already recorded." }
  if (-not $AuthorizeMigrationRepair) { throw "Automation SQL is equivalent but official migration repair is not separately authorized." }
  $authorization = Assert-JsonAttestation $AuthorizationRecord @("allowMigrationRepair") @{
    projectRef = $SupabaseProjectRef; commit = $ExpectedCommit
  }
  foreach ($version in $missing) {
    Invoke-Supabase @("migration", "repair", "--status", "applied", $version, "--remote=$SupabaseProjectRef", "--yes") | Out-Null
  }
  return ("Official migration repair recorded {0} verified version(s)." -f $missing.Count)
}

function Apply-InvitationMigrationIfApproved([string[]]$RemoteVersions, [string]$BackupRoot) {
  $appliedNow = $false
  if ($InvitationMigration -notin $RemoteVersions) {
    $dryRun = Invoke-Supabase @("db", "push", "--dry-run", "--skip-vault", "--remote=$SupabaseProjectRef")
    $mentioned = @([regex]::Matches($dryRun, '\b\d{14}\b') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    if ($mentioned.Count -ne 1 -or $mentioned[0] -ne $InvitationMigration) {
      throw "Database push dry-run did not contain exactly the invitation-state migration."
    }
    if (-not $AuthorizeSchemaMigration) { throw "The invitation-state migration is ready but not separately authorized." }
    Assert-JsonAttestation $AuthorizationRecord @("allowSchemaMigration") @{
      projectRef = $SupabaseProjectRef; commit = $ExpectedCommit
    } | Out-Null
    Invoke-Supabase @("db", "push", "--skip-vault", "--remote=$SupabaseProjectRef", "--yes") | Out-Null
    $appliedNow = $true
  }
  $postflight = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_POST_MIGRATION_READ_ONLY_CHECKS.sql"
  Invoke-ReadOnlySql $postflight (Join-Path $EvidenceRoot "post-migration-checks.json") | Out-Null
  $snapshotSql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SNAPSHOT_READ_ONLY.sql"
  $afterRaw = Invoke-ReadOnlySql $snapshotSql (Join-Path $EvidenceRoot "post-migration-counts.json") | ConvertFrom-Json
  $beforeRaw = Get-Content -Raw -LiteralPath (Join-Path $BackupRoot "source-counts.json") | ConvertFrom-Json
  $after = (Get-JsonPropertyRecursive $afterRaw "release_snapshot") | ConvertTo-Json -Compress -Depth 20
  $before = (Get-JsonPropertyRecursive $beforeRaw "release_snapshot") | ConvertTo-Json -Compress -Depth 20
  if ($before -ne $after) {
    throw "Auth, administrator, client, file, document, or queue counts changed during the invitation migration window."
  }
  if ($appliedNow) { return "Invitation-state migration applied through the official CLI; all preservation counts and postflight checks passed." }
  return "Invitation-state migration was already recorded; no replay occurred and preservation counts passed."
}

function Test-SchedulerStateReadOnly([string]$EvidenceFile) {
  $schedulerSql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SCHEDULER_STATE_READ_ONLY.sql"
  $output = Invoke-ReadOnlySql $schedulerSql $EvidenceFile
  $parsed = $output | ConvertFrom-Json
  $snapshot = Get-JsonPropertyRecursive $parsed "release_snapshot"
  if ($null -eq $snapshot) { throw "Scheduler state could not be parsed." }
  if ($snapshot.required_vault_names_present -ne $true) { throw "Required worker Vault secret names are not both configured." }
  if (@($snapshot.cron_jobs).Count -ne 0) { throw "Automation Cron is already configured; release requires it to remain inactive." }
  return "Worker secret names are present and the automation Cron job is inactive."
}

function Invoke-ProductionSmokeTests {
  foreach ($path in @("/", "/login")) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($ProductionOrigin + $path) -Method Get -MaximumRedirection 5
    if ($response.StatusCode -ne 200) { throw "Production GET smoke failed for a public route." }
    foreach ($header in @("content-security-policy", "x-content-type-options", "referrer-policy")) {
      if (-not $response.Headers[$header]) { throw "A required production security header was absent." }
    }
  }
  try {
    Invoke-WebRequest -UseBasicParsing -Uri ($ProductionOrigin + "/api/internal/automation") -Method Post `
      -ContentType "application/json" -Body '{"source":"release-smoke"}' | Out-Null
    throw "The automation worker accepted an unauthenticated request."
  } catch {
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { return }
    throw
  }
}

function Write-ReleaseReports {
  $overall = if ($Blockers.Count -eq 0 -and -not $ReleaseStopped) { "PASS" } else { "FAIL" }
  $report = [pscustomobject]@{
    format = "zevantaa-production-release-report-v1"
    mode = $Mode
    overall = $overall
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    branch = $ExpectedBranch
    commit = $ExpectedCommit
    productionOrigin = $ProductionOrigin
    supabaseProjectRef = $SupabaseProjectRef
    cronActivated = $false
    results = $Results
    blockers = $Blockers
  }
  $jsonPath = Join-Path $EvidenceRoot "release-report.json"
  [System.IO.File]::WriteAllText($jsonPath, ($report | ConvertTo-Json -Depth 20), [System.Text.UTF8Encoding]::new($false))
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# Zevantaa production release report")
  $lines.Add("")
  $lines.Add("- Mode: ``$Mode``")
  $lines.Add("- Result: **$overall**")
  $lines.Add("- Commit: ``$ExpectedCommit``")
  $lines.Add("- Generated UTC: ``$($report.generatedAtUtc)``")
  $lines.Add("- Cron activated: **No**")
  $lines.Add("")
  $lines.Add("| Check | Result | Summary | Recovery |")
  $lines.Add("| --- | --- | --- | --- |")
  foreach ($result in $Results) {
    $safeSummary = ([string]$result.summary).Replace("|", "\\|").Replace("`r", " ").Replace("`n", " ")
    $safeRecovery = ([string]$result.recovery).Replace("|", "\\|").Replace("`r", " ").Replace("`n", " ")
    $lines.Add("| $($result.name) | $($result.status) | $safeSummary | $safeRecovery |")
  }
  $lines.Add("")
  $lines.Add("This report contains no credentials or candidate data. Detailed backup and provider evidence remains in this restricted evidence directory.")
  [System.IO.File]::WriteAllLines((Join-Path $EvidenceRoot "release-report.md"), $lines, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Release evidence: $EvidenceRoot"
  return $overall
}

Push-Location $RepositoryRoot
try {
  $branchOk = Invoke-Check "Git branch and remote" {
    $branch = Get-GitValue @("rev-parse", "--abbrev-ref", "HEAD")
    $remote = Get-GitValue @("remote", "get-url", "origin")
    if ($branch -ne $ExpectedBranch -or $remote -ne $ExpectedRemote) { throw "Repository branch or origin is not the approved Zevantaa target." }
    "Approved feature branch and Zevantaa origin verified."
  } "Switch to the approved branch and verify the Zevantaa Git origin."

  $cleanOk = Invoke-Check "Git cleanliness and commit" {
    $head = Get-GitValue @("rev-parse", "HEAD")
    if (-not $ExpectedCommit) { $script:ExpectedCommit = $head }
    if ($head -ne $ExpectedCommit) { throw "HEAD does not match the operator-approved immutable commit." }
    $dirty = Get-GitValue @("status", "--short")
    if ($dirty -and -not ($Mode -eq "DryRun" -and $AllowDirtyWorkingTree)) { throw "Working tree is not clean." }
    if ($dirty) { "Development-only dirty-tree override accepted for this dry run." } else { "Working tree is clean and commit is immutable for this run." }
  } "Commit or remove unrelated changes, then rerun with the exact approved SHA."

  Invoke-Check "Release toolchain" {
    if ($PSVersionTable.PSVersion.Major -lt 5) { throw "Windows PowerShell 5.1 or PowerShell 7 is required." }
    $missingTools = @(@("node", "npm.cmd", "npx.cmd", "git", "docker", "psql") |
      Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) })
    if ($missingTools.Count -gt 0) { throw ("Required release tools are unavailable: " + ($missingTools -join ", ") + ".") }
    Invoke-External "docker" @("version", "--format", "{{.Server.Version}}") | Out-Null
    $supabaseVersion = (Invoke-Supabase @("--version")).Trim()
    $vercelVersion = (Invoke-Vercel @("--version")).Trim()
    if ($supabaseVersion -notmatch "3\.1\.0" -or $vercelVersion -notmatch "65\.14\.0") {
      throw "Pinned provider CLI versions did not execute as expected."
    }
    "PowerShell, Node, npm, Git, Docker, psql, and pinned provider CLIs are available."
  } "Install/start Docker Desktop and install PostgreSQL psql on PATH before any backup or restore run." | Out-Null

  Invoke-Check "Full regression suite" { Invoke-External "npm.cmd" @("test") | Out-Null; "All regression tests passed." } "Fix failing tests; do not continue the release." | Out-Null
  Invoke-Check "ESLint" { Invoke-External "npm.cmd" @("run", "lint") | Out-Null; "Lint passed." } "Fix lint errors." | Out-Null
  Invoke-Check "TypeScript" { Invoke-External "npx.cmd" @("tsc", "--noEmit") | Out-Null; "TypeScript passed." } "Fix type errors." | Out-Null
  Invoke-Check "Production build" { Invoke-External "npm.cmd" @("run", "build") | Out-Null; "Optimized build passed." } "Fix the production build." | Out-Null
  Invoke-Check "Secret scan" { Invoke-External "npm.cmd" @("run", "security:secrets") | Out-Null; "Repository secret scan passed." } "Remove exposed credentials and rotate them outside this script." | Out-Null
  Invoke-Check "Production dependency audit" { Invoke-External "npm.cmd" @("audit", "--omit=dev") | Out-Null; "Production audit found no vulnerabilities." } "Triage production dependency findings." | Out-Null
  Invoke-Check "Whitespace check" { Invoke-External "git" @("diff", "--check", "$ExpectedCommit^") | Out-Null; "Commit whitespace check passed." } "Correct whitespace errors and create a new reviewed commit." | Out-Null
  Assert-ReleaseCanContinue "local validation"

  Invoke-Check "GitHub authorization" {
    Invoke-External "git" @("ls-remote", "--exit-code", "origin", "HEAD") | Out-Null
    Invoke-External "git" @("push", "--dry-run", "origin", "HEAD:refs/heads/$ExpectedBranch") | Out-Null
    "GitHub read and dry-run push authorization verified without changing the remote."
  } "Authenticate Git for Zevantaa/Zevantaa-resume-builder with read/write access; never use a Sofiology remote." | Out-Null

  Invoke-Check "Supabase authorization" {
    $projects = Invoke-Supabase @("--output-format", "json", "projects", "list")
    if ($projects -notmatch [regex]::Escape($SupabaseProjectRef)) { throw "Authorized Supabase projects do not include the Zevantaa production reference." }
    Invoke-Supabase @("db", "query", "--remote=$SupabaseProjectRef", "--read-only", "select current_database() as database_name;") | Out-Null
    "Supabase project and read-only database access verified."
  } "Authenticate the pinned Supabase CLI with scoped projects_read/database_read access to fzltowzpfrnuxxxrzuih." | Out-Null

  Invoke-Check "Vercel authorization and project link" {
    $linkPath = Join-Path $RepositoryRoot ".vercel\project.json"
    if (-not (Test-Path -LiteralPath $linkPath)) { throw "The local repository is not linked to an existing Vercel project." }
    $link = Get-Content -Raw -LiteralPath $linkPath | ConvertFrom-Json
    if ($VercelProjectId -and $link.projectId -ne $VercelProjectId) { throw "The Vercel link does not match the operator-approved project ID." }
    $script:VercelProjectId = $link.projectId
    $deployment = Invoke-Vercel @("inspect", $ProductionOrigin, "--json") | ConvertFrom-Json
    $liveProjectId = Get-JsonPropertyRecursive $deployment "projectId"
    if ($liveProjectId -and $liveProjectId -ne $VercelProjectId) { throw "The production domain resolves to a different Vercel project." }
    Invoke-Vercel @("project", "inspect", $VercelProjectId) | Out-Null
    "Existing Vercel project and production domain authorization verified."
  } "Run an operator-reviewed Vercel link to the existing Zevantaa project, then rerun with its approved project ID." | Out-Null
  Assert-ReleaseCanContinue "provider authorization"

  if ($Mode -eq "DryRun") {
    Add-Result "Production backup and isolated restore" "BLOCKED" "Not executed in dry-run mode." "Run Release mode only after access, authorization, off-repository evidence storage, Docker, and psql are ready."
    Add-Result "Migration equivalence and repair" "BLOCKED" "No live schema mutation or history repair was attempted." "Authorize only after an empty shadow-vs-live diff and signed equivalence evidence."
    Add-Result "Invitation migration" "BLOCKED" "No production migration was executed." "Complete backup/restore and separately authorize the single onboarding migration."
    Add-Result "Auth, SMTP, and production environment" "BLOCKED" "Provider configuration attestation was not consumed in dry-run mode." "Complete the secret-free Auth/SMTP checklist and Vercel production environment validation."
    Add-Result "Production deployment and smoke tests" "BLOCKED" "No deployment or post-deployment request was performed." "Obtain separate deployment approval after all earlier gates pass."
    Add-Result "Automation Cron" "PASS" "Cron was not activated; activation is intentionally outside this orchestrator."
  } else {
    if (-not ($AuthorizeSchemaMigration -and $AuthorizeDeployment)) {
      throw "Release mode requires separate schema-migration and deployment authorization switches."
    }
    Assert-JsonAttestation $AuthorizationRecord @("allowSchemaMigration", "allowDeployment") @{
      projectRef = $SupabaseProjectRef; productionOrigin = $ProductionOrigin; commit = $ExpectedCommit
    } | Out-Null
    Invoke-Check "Auth and SMTP attestation" {
      Assert-JsonAttestation $AuthConfigurationAttestation @(
        "customSmtpConfigured", "siteUrlMatches", "exactRedirectsConfigured",
        "inviteTemplateVerified", "recoveryTemplateVerified", "signupDisabled",
        "anonymousSignInDisabled", "privateBucketsVerified", "anonymousStorageDenied",
        "crossClientRlsDenied", "workerSecretsIndependentlyVerified", "secretValuesExcluded"
      ) @{ projectRef = $SupabaseProjectRef; productionOrigin = $ProductionOrigin } | Out-Null
      "Secret-free Auth callback, SMTP, and account-policy evidence verified."
    } "Complete and independently review the production Auth/SMTP attestation." | Out-Null
    Invoke-Check "Vercel production environment" {
      $names = Invoke-Vercel @("env", "list", "--environment", "production", "--project", $VercelProjectId)
      foreach ($name in $RequiredVercelEnvironmentNames) {
        if ($names -notmatch [regex]::Escape($name)) { throw "A required production environment variable name is missing." }
      }
      Invoke-Vercel @("env", "run", "--environment", "production", "--project", $VercelProjectId,
        "--", "node", "scripts/validate-environment.mjs", "production") | Out-Null
      "Required variable names and secret-injected production validation passed without printing values."
    } "Configure the required Vercel Production variables in the existing Zevantaa project." | Out-Null
    Invoke-Check "Automation worker and scheduler preflight" {
      Test-SchedulerStateReadOnly (Join-Path $EvidenceRoot "scheduler-preflight.json")
    } "Configure and independently verify the matching Vercel/Vault worker secrets, while keeping Cron inactive." | Out-Null
    Assert-ReleaseCanContinue "configuration validation"

    $backupRoot = $null
    Invoke-Check "Production backup" {
      $securitySql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SECURITY_READ_ONLY.sql"
      Invoke-ReadOnlySql $securitySql (Join-Path $EvidenceRoot "pre-release-security-state.json") | Out-Null
      $script:backupRoot = New-ProductionBackup
      "Official database dumps and all three private bucket object backups verified with SHA-256 evidence."
    } "Correct backup access or integrity; do not change schema." | Out-Null
    Assert-ReleaseCanContinue "production backup"
    Invoke-Check "Isolated restore validation" { Test-IsolatedRestore $backupRoot | Out-Null; "Isolated database and private Storage restore matched production counts and object checksums." } "Fix the isolated restore and rerun from a fresh target; do not change production." | Out-Null
    Assert-ReleaseCanContinue "isolated restore"

    Invoke-Check "Automation migration equivalence" { Test-AutomationMigrationEquivalence | Out-Null; "Live public schema exactly matches a shadow built through the six automation migrations." } "Prepare a reviewed forward reconciliation migration; never replay the six files." | Out-Null
    Assert-ReleaseCanContinue "migration equivalence"
    $remoteVersions = Get-RemoteMigrationVersions
    Invoke-Check "Official migration history repair" { Repair-MigrationHistoryIfApproved $remoteVersions } "Obtain explicit repair approval only after equivalence is proved." | Out-Null
    Assert-ReleaseCanContinue "migration history repair"
    $remoteVersions = Get-RemoteMigrationVersions
    Invoke-Check "Invitation-state migration" { Apply-InvitationMigrationIfApproved $remoteVersions $backupRoot } "Stop, preserve evidence, and use a reviewed forward repair if application fails." | Out-Null
    Assert-ReleaseCanContinue "schema migration"

    Invoke-Check "Vercel production deployment" {
      if (-not $AuthorizeDeployment) { throw "Production deployment is not authorized." }
      Invoke-Vercel @("deploy", $RepositoryRoot, "--prod", "--yes", "--project", $VercelProjectId, "--json") | Out-Null
      "Reviewed immutable commit deployed to the existing Zevantaa production project."
    } "Keep Cron disabled and redeploy the last known-good immutable commit if smoke tests fail." | Out-Null
    Assert-ReleaseCanContinue "production deployment"
    Invoke-Check "Read-only production smoke tests" { Invoke-ProductionSmokeTests; "Public routes, security headers, and unauthenticated worker denial passed." } "Stop promotion, keep Cron disabled, inspect sanitized logs, and roll back the Vercel deployment." | Out-Null
    Invoke-Check "Scheduler state" {
      Test-SchedulerStateReadOnly (Join-Path $EvidenceRoot "scheduler-state.json")
    } "Investigate unexpected scheduler state without deleting queue or document history." | Out-Null
    Add-Result "Automation Cron" "PASS" "Cron was not activated; separate secret verification and authorization remain mandatory."
  }
} catch {
  $ReleaseStopped = $true
  if ($Blockers.Count -eq 0) { Add-Result "Release orchestration" "FAIL" $_.Exception.Message "Resolve the prerequisite and start a new evidence directory." }
} finally {
  Pop-Location
  $overall = Write-ReleaseReports
}

if ($overall -ne "PASS") { exit 1 }
