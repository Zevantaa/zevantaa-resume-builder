[CmdletBinding()]
param(
  [ValidateSet("DryRun", "Prepare", "Release")]
  [string]$Mode = "DryRun",
  [string]$ExpectedCommit = "",
  [string]$EvidenceRoot = "",
  [string]$AuthorizationRecord = "",
  [string]$AuthConfigurationAttestation = "",
  [string]$VercelProjectId = "",
  [string]$AgeRecoveryKeyPath = "",
  [string]$AgeOfflineRecoveryRecipient = "",
  [switch]$InitializeAgeRecoveryKey,
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
$VercelTeamSlug = "zevantaa-careers-pvt-ltd"
$SupabaseCli = "supabase@3.1.0"
$VercelCli = "vercel@65.14.0"
$AgeVersion = "1.3.2"
$RestorePostgresImage = "public.ecr.aws/supabase/postgres:17.11.0.018"
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
$SourceSnapshot = $null
$AgeKeyMaterial = $null

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

function ConvertTo-ProcessArgument([string]$Value) {
  if ($null -eq $Value) { return '""' }
  return '"' + $Value.Replace('"', '\"') + '"'
}

function Invoke-ProcessWithStandardInput([string]$FilePath, [string[]]$Arguments, [string]$InputText) {
  $command = Get-Command $FilePath -ErrorAction Stop
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $process.StartInfo.FileName = $command.Source
  $process.StartInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' ')
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.CreateNoWindow = $true
  $process.StartInfo.RedirectStandardInput = $true
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true
  try {
    [void]$process.Start()
    $process.StandardInput.Write($InputText)
    $process.StandardInput.Close()
    $output = $process.StandardOutput.ReadToEnd()
    $errorOutput = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "A protected streaming subprocess failed." }
    return $output
  } finally {
    $InputText = $null
    $errorOutput = $null
    $process.Dispose()
  }
}

function Set-RestrictedFileAcl([string]$Path) {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = [System.Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $allow = [System.Security.AccessControl.AccessControlType]::Allow
  $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity, "FullControl", $allow))
  $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new("NT AUTHORITY\SYSTEM", "FullControl", $allow))
  Set-Acl -LiteralPath $Path -AclObject $acl
}

function Initialize-ZevantaaDpapi {
  if ("ZevantaaRelease.Dpapi" -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace ZevantaaRelease {
  public static class Dpapi {
    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob { public int Length; public IntPtr Data; }

    [DllImport("Crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CryptProtectData(ref DataBlob input, string description,
      ref DataBlob entropy, IntPtr reserved, IntPtr prompt, int flags, out DataBlob output);

    [DllImport("Crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CryptUnprotectData(ref DataBlob input, out IntPtr description,
      ref DataBlob entropy, IntPtr reserved, IntPtr prompt, int flags, out DataBlob output);

    [DllImport("Kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);

    private static DataBlob Allocate(byte[] value) {
      var blob = new DataBlob { Length = value.Length, Data = Marshal.AllocHGlobal(value.Length) };
      Marshal.Copy(value, 0, blob.Data, value.Length);
      return blob;
    }

    private static void FreeAllocated(DataBlob blob) {
      if (blob.Data != IntPtr.Zero) Marshal.FreeHGlobal(blob.Data);
    }

    private static byte[] CopyAndFree(DataBlob blob) {
      try {
        var value = new byte[blob.Length];
        Marshal.Copy(blob.Data, value, 0, blob.Length);
        return value;
      } finally {
        if (blob.Data != IntPtr.Zero) LocalFree(blob.Data);
      }
    }

    public static byte[] Protect(byte[] value, byte[] entropy) {
      var input = Allocate(value);
      var extra = Allocate(entropy);
      try {
        DataBlob output;
        if (!CryptProtectData(ref input, "Zevantaa production backup identity", ref extra,
          IntPtr.Zero, IntPtr.Zero, 1, out output)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return CopyAndFree(output);
      } finally { FreeAllocated(input); FreeAllocated(extra); }
    }

    public static byte[] Unprotect(byte[] value, byte[] entropy) {
      var input = Allocate(value);
      var extra = Allocate(entropy);
      IntPtr description = IntPtr.Zero;
      try {
        DataBlob output;
        if (!CryptUnprotectData(ref input, out description, ref extra,
          IntPtr.Zero, IntPtr.Zero, 1, out output)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return CopyAndFree(output);
      } finally {
        if (description != IntPtr.Zero) LocalFree(description);
        FreeAllocated(input);
        FreeAllocated(extra);
      }
    }
  }
}
'@
}

function Get-AgeEntropy {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes("zevantaa-production-backup|$SupabaseProjectRef|v1")
  try { return [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes) }
  finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

function Initialize-AgeRecoveryKey([string]$Path) {
  if (Test-Path -LiteralPath $Path) { throw "The protected age recovery key already exists and will not be overwritten." }
  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $identity = Invoke-ProcessWithStandardInput "age-keygen" @("-pq") ""
  if ($identity -notmatch '(?m)^# public key:\s*(age1pq1[a-z0-9]+)\s*$' -or
      $identity -notmatch '(?m)^AGE-SECRET-KEY-PQ-1[A-Z0-9]+\s*$') {
    throw "age-keygen did not return a valid post-quantum identity."
  }
  $identityBytes = [System.Text.Encoding]::UTF8.GetBytes($identity)
  $entropy = Get-AgeEntropy
  try {
    Initialize-ZevantaaDpapi
    $protected = [ZevantaaRelease.Dpapi]::Protect($identityBytes, $entropy)
    [System.IO.File]::WriteAllBytes($Path, $protected)
    Set-RestrictedFileAcl $Path
  } finally {
    [Array]::Clear($identityBytes, 0, $identityBytes.Length)
    [Array]::Clear($entropy, 0, $entropy.Length)
    if ($null -ne $protected) { [Array]::Clear($protected, 0, $protected.Length) }
    $identity = $null
  }
}

function Get-AgeKeyMaterial {
  if (-not $AgeRecoveryKeyPath) { throw "An absolute DPAPI-protected age recovery-key path is required." }
  if (-not [System.IO.Path]::IsPathRooted($AgeRecoveryKeyPath)) {
    throw "The age recovery-key path must be absolute."
  }
  $path = [System.IO.Path]::GetFullPath($AgeRecoveryKeyPath)
  if ((Test-PathWithin $RepositoryRoot $path) -or
      (Test-PathWithin $EvidenceRoot $path)) {
    throw "The age recovery key must be outside both the repository and release evidence directory."
  }
  if ($InitializeAgeRecoveryKey -and -not (Test-Path -LiteralPath $path)) { Initialize-AgeRecoveryKey $path }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "The separately protected age recovery key is missing." }
  $protected = [System.IO.File]::ReadAllBytes($path)
  $entropy = Get-AgeEntropy
  try {
    Initialize-ZevantaaDpapi
    $identityBytes = [ZevantaaRelease.Dpapi]::Unprotect($protected, $entropy)
    $identity = [System.Text.Encoding]::UTF8.GetString($identityBytes)
    $recipientMatch = [regex]::Match($identity, '(?m)^# public key:\s*(age1pq1[a-z0-9]+)\s*$')
    $identityMatch = [regex]::Match($identity, '(?m)^AGE-SECRET-KEY-PQ-1[A-Z0-9]+\s*$')
    if (-not $recipientMatch.Success -or -not $identityMatch.Success) {
      throw "The protected age recovery identity is invalid."
    }
    $localRecipient = $recipientMatch.Groups[1].Value
    if ($AgeOfflineRecoveryRecipient -notmatch '^age1pq1[a-z0-9]+$' -or
        $AgeOfflineRecoveryRecipient -eq $localRecipient) {
      throw "A distinct offline post-quantum age recovery recipient is required."
    }
    return [pscustomobject]@{
      Path = $path
      Identity = $identity
      Recipient = $localRecipient
      Recipients = @($localRecipient, $AgeOfflineRecoveryRecipient)
    }
  } finally {
    [Array]::Clear($protected, 0, $protected.Length)
    [Array]::Clear($entropy, 0, $entropy.Length)
    if ($null -ne $identityBytes) { [Array]::Clear($identityBytes, 0, $identityBytes.Length) }
  }
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
  if ($null -eq $AgeKeyMaterial) { throw "The protected age recovery key has not been loaded." }
  $backupRoot = Join-Path $EvidenceRoot "production-backup"
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $ageBinary = (Get-Command age -ErrorAction Stop).Source
  $dockerBinary = (Get-Command docker -ErrorAction Stop).Source
  $dumpHelper = Join-Path $RepositoryRoot "scripts\stream-encrypted-database-dump.mjs"
  $dumpSpecifications = @(
    @{ File = "roles.sql.age"; Arguments = @("--role-only") },
    @{ File = "managed-schema.sql.age"; Arguments = @("--schema", "auth,storage") },
    @{ File = "schema.sql.age"; Arguments = @() },
    @{ File = "data.sql.age"; Arguments = @("--data-only", "--use-copy", "--exclude", "storage.buckets_vectors", "--exclude", "storage.vector_indexes") },
    @{ File = "history-schema.sql.age"; Arguments = @("--schema", "supabase_migrations") },
    @{ File = "history-data.sql.age"; Arguments = @("--schema", "supabase_migrations", "--data-only", "--use-copy") }
  )
  foreach ($specification in $dumpSpecifications) {
    $plan = Invoke-Supabase (@("db", "dump", "--dry-run", "--remote=$SupabaseProjectRef") + $specification.Arguments)
    try {
      $streamArguments = @(
        $dumpHelper,
        "--output", (Join-Path $backupRoot $specification.File),
        "--age-binary", $ageBinary,
        "--docker-binary", $dockerBinary,
        "--postgres-image", $RestorePostgresImage
      )
      foreach ($recipient in $AgeKeyMaterial.Recipients) { $streamArguments += @("--recipient", $recipient) }
      $streamResult = Invoke-ProcessWithStandardInput "node" $streamArguments $plan | ConvertFrom-Json
      if ($streamResult.encryptedBytes -lt 200 -or -not $streamResult.ciphertextSha256) {
        throw "An encrypted database artifact did not verify."
      }
    } finally { $plan = $null }
  }
  $snapshotSql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SNAPSHOT_READ_ONLY.sql"
  $snapshotOutput = Invoke-Supabase @(
    "--output-format", "json", "db", "query", "--remote=$SupabaseProjectRef",
    "--read-only", "--file", $snapshotSql
  )
  $snapshotJson = $snapshotOutput | ConvertFrom-Json
  $script:SourceSnapshot = Get-JsonPropertyRecursive $snapshotJson "release_snapshot"
  if ($null -eq $SourceSnapshot) {
    throw "The production count snapshot was not returned in the expected safe format."
  }
  $snapshotArguments = @(
    (Join-Path $RepositoryRoot "scripts\stream-age-encrypt.mjs"),
    "--output", (Join-Path $backupRoot "source-counts.json.age"),
    "--age-binary", $ageBinary
  )
  foreach ($recipient in $AgeKeyMaterial.Recipients) { $snapshotArguments += @("--recipient", $recipient) }
  $snapshotEncryption = Invoke-ProcessWithStandardInput "node" $snapshotArguments $snapshotOutput | ConvertFrom-Json
  if ($snapshotEncryption.encryptedBytes -lt 200) { throw "The encrypted source snapshot did not verify." }
  $snapshotOutput = $null

  $storageRoot = Join-Path $backupRoot "private-storage"
  $apiKeyOutput = Invoke-Supabase @(
    "--output-format", "json", "projects", "api-keys", "--reveal", "--remote=$SupabaseProjectRef"
  ) | ConvertFrom-Json
  $secretKeys = @($apiKeyOutput.keys | Where-Object { $_.type -eq "secret" -and $_.name -eq "default" })
  if ($secretKeys.Count -ne 1 -or ([string]$secretKeys[0].api_key).Length -lt 32) {
    throw "Exactly one scoped default Supabase secret key is required for private Storage backup."
  }
  $previousUrl = $env:NEXT_PUBLIC_SUPABASE_URL
  $previousKey = $env:SUPABASE_SECRET_KEY
  try {
    $env:NEXT_PUBLIC_SUPABASE_URL = "https://$SupabaseProjectRef.supabase.co"
    $env:SUPABASE_SECRET_KEY = [string]$secretKeys[0].api_key
    $storageArguments = @(
      (Join-Path $RepositoryRoot "scripts\backup-private-storage.mjs"),
      "--output", $storageRoot,
      "--age-binary", $ageBinary
    )
    foreach ($recipient in $AgeKeyMaterial.Recipients) { $storageArguments += @("--recipient", $recipient) }
    $storageOutput = Invoke-External "node" $storageArguments
  } finally {
    $env:NEXT_PUBLIC_SUPABASE_URL = $previousUrl
    $env:SUPABASE_SECRET_KEY = $previousKey
    $secretKeys = $null
    $apiKeyOutput = $null
  }
  $storageSummary = $storageOutput.Trim() | ConvertFrom-Json
  if ($storageSummary.bucketCount -ne 3 -or $storageSummary.objectCount -lt 0 -or
      $storageSummary.plaintextObjectBytes -lt 0) {
    throw "Private Storage backup evidence was incomplete."
  }
  Write-Checksums $backupRoot | Out-Null
  $plaintextArtifacts = @(Get-ChildItem -LiteralPath $backupRoot -File -Recurse | Where-Object {
    $_.Name -ne "checksums.sha256" -and $_.Extension -ne ".age"
  })
  if ($plaintextArtifacts.Count -ne 0) { throw "A plaintext production backup artifact was written unexpectedly." }
  return $backupRoot
}

function Test-IsolatedRestore([string]$BackupRoot) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is required for isolated restore validation."
  }
  if ($null -eq $AgeKeyMaterial -or -not $AgeKeyMaterial.Identity) {
    throw "The protected age recovery identity is unavailable for restore validation."
  }
  $dockerBinary = (Get-Command docker -ErrorAction Stop).Source
  Invoke-External $dockerBinary @("image", "inspect", $RestorePostgresImage) | Out-Null
  $container = "zevantaa-encrypted-restore-" + [guid]::NewGuid().ToString("N")
  $started = $false
  try {
    Invoke-External $dockerBinary @(
      "run", "--detach", "--rm", "--name", $container, "--network", "none",
      "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=4g",
      "--tmpfs", "/restore:rw,noexec,nosuid,size=2g",
      "--env", "POSTGRES_PASSWORD=local-memory-restore-only",
      $RestorePostgresImage
    ) | Out-Null
    $started = $true
    $ready = $false
    foreach ($attempt in 1..45) {
      try {
        Invoke-External $dockerBinary @("exec", $container, "pg_isready", "--username", "postgres") | Out-Null
        $ready = $true
        break
      } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "The memory-backed PostgreSQL restore target did not become ready." }
    $restoreOutput = Invoke-ProcessWithStandardInput "node" @(
      (Join-Path $RepositoryRoot "scripts\verify-encrypted-backup-restore.mjs"),
      "--backup-root", $BackupRoot,
      "--container", $container,
      "--age-binary", (Get-Command age -ErrorAction Stop).Source,
      "--docker-binary", $dockerBinary,
      "--snapshot-sql", (Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SNAPSHOT_READ_ONLY.sql"),
      "--confirm-memory-only-target"
    ) $AgeKeyMaterial.Identity
    $restored = $restoreOutput.Trim() | ConvertFrom-Json
    if ($restored.databaseSnapshotMatched -ne $true -or $restored.bucketCount -ne 3 -or
        $restored.restoredObjectCount -lt 0 -or $restored.plaintextPersistentWrites -ne 0) {
      throw "Encrypted backup recovery evidence was incomplete."
    }
    [System.IO.File]::WriteAllText((Join-Path $EvidenceRoot "RESTORE-PASSED.txt"),
      ("Age-authenticated database and private Storage recovery verified in Docker tmpfs at {0}." -f (Get-Date).ToUniversalTime().ToString("o")),
      [System.Text.UTF8Encoding]::new($false))
  } finally {
    if ($started) { try { Invoke-External $dockerBinary @("rm", "--force", $container) | Out-Null } catch { } }
    if ($null -ne $AgeKeyMaterial) { $AgeKeyMaterial.Identity = $null }
  }
  return (Join-Path $EvidenceRoot "RESTORE-PASSED.txt")
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
  $diffPath = Join-Path $baselineRoot "automation-to-live.sql"
  $reversePath = Join-Path $baselineRoot "live-to-automation.sql"
  Invoke-Supabase @("db", "diff", "--from", "migrations", "--to", $SupabaseProjectRef,
    "--schema", "public", "--strict-coverage", "--output", $diffPath, "--workdir", $baselineRoot) | Out-Null
  $forward = (Get-Content -Raw -LiteralPath $diffPath).Replace("`r`n", "`n").Trim()
  if ($forward) {
    Invoke-Supabase @("db", "diff", "--from", $SupabaseProjectRef, "--to", "migrations",
      "--schema", "public", "--strict-coverage", "--output", $reversePath, "--workdir", $baselineRoot) | Out-Null
    $reverse = (Get-Content -Raw -LiteralPath $reversePath).Replace("`r`n", "`n").Trim()
    if ($forward -ne $reverse) {
      throw "Bidirectional public-schema comparison found a material difference."
    }
    $functionPattern = '(?is)CREATE OR REPLACE FUNCTION\b.*?\bAS\s+\$function\$.*?\$function\$\s*;'
    $functionMatches = [regex]::Matches($forward, $functionPattern)
    $remainder = [regex]::Replace($forward, $functionPattern, '')
    $remainder = $remainder -replace '(?im)^\s*SET\s+local\s+check_function_bodies\s*=\s*off\s*;\s*$', ''
    $remainder = $remainder -replace '(?m)^\s*--.*$', '' -replace '\s', ''
    if ($functionMatches.Count -lt 1 -or $remainder) {
      throw "Schema comparison contains differences outside bidirectionally identical function canonicalization."
    }
    $canonicalEvidence = [pscustomobject]@{
      format = "zevantaa-bidirectional-function-equivalence-v1"
      functionCount = $functionMatches.Count
      sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $diffPath).Hash.ToLowerInvariant()
    }
    [System.IO.File]::WriteAllText(
      (Join-Path $baselineRoot "function-canonicalization.json"),
      ($canonicalEvidence | ConvertTo-Json),
      [System.Text.UTF8Encoding]::new($false)
    )
  }
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

function Test-InvitationMigrationDryRun([string[]]$RemoteVersions) {
  if ($InvitationMigration -in $RemoteVersions) {
    return "Invitation-state migration is already recorded; no replay is needed."
  }
  $dryRun = Invoke-Supabase @("db", "push", "--dry-run", "--skip-vault", "--remote=$SupabaseProjectRef")
  $mentioned = @([regex]::Matches($dryRun, '\b\d{14}\b') | ForEach-Object { $_.Value } | Sort-Object -Unique)
  if ($mentioned.Count -ne 1 -or $mentioned[0] -ne $InvitationMigration) {
    throw "Database push dry-run did not contain exactly the invitation-state migration."
  }
  return "Official database push dry-run contains exactly the invitation-state migration."
}

function Apply-InvitationMigrationIfApproved([string[]]$RemoteVersions, [string]$BackupRoot) {
  $appliedNow = $false
  if ($InvitationMigration -notin $RemoteVersions) {
    Test-InvitationMigrationDryRun $RemoteVersions | Out-Null
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
  $after = (Get-JsonPropertyRecursive $afterRaw "release_snapshot") | ConvertTo-Json -Compress -Depth 20
  if ($null -eq $SourceSnapshot) { throw "The in-memory pre-migration preservation snapshot is unavailable." }
  $before = $SourceSnapshot | ConvertTo-Json -Compress -Depth 20
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
    $missingTools = @(@("node", "npm.cmd", "npx.cmd", "git", "docker", "age", "age-keygen") |
      Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) })
    if ($missingTools.Count -gt 0) { throw ("Required release tools are unavailable: " + ($missingTools -join ", ") + ".") }
    Invoke-External "docker" @("version", "--format", "{{.Server.Version}}") | Out-Null
    $ageVersionOutput = (Invoke-External "age" @("--version")).Trim()
    if ($ageVersionOutput -notmatch [regex]::Escape($AgeVersion)) { throw "The approved age version $AgeVersion is required." }
    Invoke-External "docker" @("image", "inspect", $RestorePostgresImage) | Out-Null
    $supabaseVersion = (Invoke-Supabase @("--version")).Trim()
    $vercelVersion = (Invoke-Vercel @("--version")).Trim()
    if ($supabaseVersion -notmatch "3\.1\.0" -or $vercelVersion -notmatch "65\.14\.0") {
      throw "Pinned provider CLI versions did not execute as expected."
    }
    "PowerShell, Node, npm, Git, Docker, age, the memory-only restore image, and pinned provider CLIs are available."
  } "Install the approved age release, start Docker Desktop, and pre-pull the pinned Supabase Postgres image." | Out-Null

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
    $deployment = Invoke-Vercel @("--scope", $VercelTeamSlug, "inspect", $ProductionOrigin, "--json") | ConvertFrom-Json
    $liveProjectId = Get-JsonPropertyRecursive $deployment "projectId"
    if ($liveProjectId -and $liveProjectId -ne $VercelProjectId) { throw "The production domain resolves to a different Vercel project." }
    Invoke-Vercel @("--scope", $VercelTeamSlug, "project", "inspect", $VercelProjectId) | Out-Null
    "Existing Vercel project and production domain authorization verified."
  } "Run an operator-reviewed Vercel link to the existing Zevantaa project, then rerun with its approved project ID." | Out-Null
  Assert-ReleaseCanContinue "provider authorization"

  if ($Mode -eq "DryRun") {
    Add-Result "Production backup and isolated restore" "BLOCKED" "Not executed in dry-run mode." "Run Release mode only after access, authorization, off-repository evidence storage, and Docker are ready."
    Add-Result "Migration equivalence and repair" "BLOCKED" "No live schema mutation or history repair was attempted." "Authorize only after an empty shadow-vs-live diff and signed equivalence evidence."
    Add-Result "Invitation migration" "BLOCKED" "No production migration was executed." "Complete backup/restore and separately authorize the single onboarding migration."
    Add-Result "Auth, SMTP, and production environment" "BLOCKED" "Provider configuration attestation was not consumed in dry-run mode." "Complete the secret-free Auth/SMTP checklist and Vercel production environment validation."
    Add-Result "Production deployment and smoke tests" "BLOCKED" "No deployment or post-deployment request was performed." "Obtain separate deployment approval after all earlier gates pass."
    Add-Result "Automation Cron" "PASS" "Cron was not activated; activation is intentionally outside this orchestrator."
  } else {
    if ($Mode -eq "Release") {
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
    } else {
      Add-Result "Auth and SMTP attestation" "BLOCKED" "Prepare mode does not accept unverified provider configuration claims." "Inspect production Auth/SMTP settings and create the reviewed, secret-free attestation before release."
    }
    Invoke-Check "Vercel production environment" {
      $names = Invoke-Vercel @("--scope", $VercelTeamSlug, "env", "list", "--environment", "production", "--project", $VercelProjectId)
      foreach ($name in $RequiredVercelEnvironmentNames) {
        if ($names -notmatch [regex]::Escape($name)) { throw "A required production environment variable name is missing." }
      }
      $publicEnvironmentFile = Join-Path $EvidenceRoot "vercel-production-public.env"
      try {
        Invoke-Vercel @("--scope", $VercelTeamSlug, "env", "pull", $publicEnvironmentFile,
          "--environment", "production", "--project", $VercelProjectId, "--yes") | Out-Null
        $publicValues = @{}
        foreach ($line in Get-Content -LiteralPath $publicEnvironmentFile) {
          if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $publicValues[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
          }
        }
        if ($publicValues["NEXT_PUBLIC_APP_URL"] -ne $ProductionOrigin) {
          throw "Production application origin does not match the approved domain."
        }
        if ($publicValues["NEXT_PUBLIC_SUPABASE_URL"] -ne "https://$SupabaseProjectRef.supabase.co") {
          throw "Production Supabase URL does not match the approved project."
        }
        if (-not $publicValues["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
          throw "The production publishable key could not be validated."
        }
      } finally {
        if (Test-Path -LiteralPath $publicEnvironmentFile) {
          Remove-Item -LiteralPath $publicEnvironmentFile -Force
        }
      }
      "Required variable names, public origins, and publishable-key presence passed; sensitive values remained unreadable."
    } "Configure the required Vercel Production variables in the existing Zevantaa project." | Out-Null
    Invoke-Check "Automation worker and scheduler preflight" {
      Test-SchedulerStateReadOnly (Join-Path $EvidenceRoot "scheduler-preflight.json")
    } "Configure and independently verify the matching Vercel/Vault worker secrets, while keeping Cron inactive." | Out-Null
    Assert-ReleaseCanContinue "configuration validation"

    Invoke-Check "Encrypted backup recovery key" {
      $script:AgeKeyMaterial = Get-AgeKeyMaterial
      $fingerprintBytes = [System.Text.Encoding]::UTF8.GetBytes($AgeKeyMaterial.Recipient)
      try {
        $fingerprint = ([System.BitConverter]::ToString(
          [System.Security.Cryptography.SHA256]::Create().ComputeHash($fingerprintBytes)
        )).Replace("-", "").ToLowerInvariant().Substring(0, 16)
      } finally { [Array]::Clear($fingerprintBytes, 0, $fingerprintBytes.Length) }
      "DPAPI-protected post-quantum age recovery identity verified outside repository and evidence paths (recipient fingerprint $fingerprint)."
    } "Provide or initialize a separately protected age recovery key outside the backup directory." | Out-Null
    Assert-ReleaseCanContinue "encrypted backup key"

    $backupRoot = $null
    Invoke-Check "Production backup" {
      $securitySql = Join-Path $RepositoryRoot "docs\sql\ZEVANTAA_RELEASE_SECURITY_READ_ONLY.sql"
      Invoke-ReadOnlySql $securitySql (Join-Path $EvidenceRoot "pre-release-security-state.json") | Out-Null
      $script:backupRoot = New-ProductionBackup
      "Official Supabase dump plans and all three private buckets streamed directly into authenticated age encryption with SHA-256 evidence."
    } "Correct backup access or integrity; do not change schema." | Out-Null
    Assert-ReleaseCanContinue "production backup"
    Invoke-Check "Isolated restore validation" { Test-IsolatedRestore $backupRoot | Out-Null; "Docker tmpfs database and private Storage recovery matched production counts and object bytes without persistent plaintext." } "Fix the memory-only isolated restore and rerun from a fresh target; do not change production." | Out-Null
    Assert-ReleaseCanContinue "isolated restore"

    Invoke-Check "Automation migration equivalence" { Test-AutomationMigrationEquivalence | Out-Null; "Live public schema exactly matches a shadow built through the six automation migrations." } "Prepare a reviewed forward reconciliation migration; never replay the six files." | Out-Null
    Assert-ReleaseCanContinue "migration equivalence"
    $remoteVersions = Get-RemoteMigrationVersions
    if ($Mode -eq "Prepare") {
      $missingAutomation = @($AutomationVersions | Where-Object { $_ -notin $remoteVersions })
      Add-Result "Official migration history status" "PASS" ("{0} of six equivalent automation version(s) require official repair before release." -f $missingAutomation.Count)
      Invoke-Check "Invitation-state migration dry-run" { Test-InvitationMigrationDryRun $remoteVersions } "Resolve unexpected pending migrations without replaying already-applied SQL." | Out-Null
      Add-Result "Production mutation approval" "BLOCKED" "No migration history, schema, deployment, secret, or scheduler state was changed." "After reviewing this evidence, explicitly approve only the required official repair, invitation migration, and deployment."
      Add-Result "Automation Cron" "PASS" "Cron was not activated; separate secret verification and authorization remain mandatory."
    } else {
      Invoke-Check "Official migration history repair" { Repair-MigrationHistoryIfApproved $remoteVersions } "Obtain explicit repair approval only after equivalence is proved." | Out-Null
      Assert-ReleaseCanContinue "migration history repair"
      $remoteVersions = Get-RemoteMigrationVersions
      Invoke-Check "Invitation-state migration" { Apply-InvitationMigrationIfApproved $remoteVersions $backupRoot } "Stop, preserve evidence, and use a reviewed forward repair if application fails." | Out-Null
      Assert-ReleaseCanContinue "schema migration"

      Invoke-Check "Vercel production deployment" {
        if (-not $AuthorizeDeployment) { throw "Production deployment is not authorized." }
        Invoke-Vercel @("--scope", $VercelTeamSlug, "deploy", $RepositoryRoot, "--prod", "--yes", "--project", $VercelProjectId, "--json") | Out-Null
        "Reviewed immutable commit deployed to the existing Zevantaa production project."
      } "Keep Cron disabled and redeploy the last known-good immutable commit if smoke tests fail." | Out-Null
      Assert-ReleaseCanContinue "production deployment"
      Invoke-Check "Read-only production smoke tests" { Invoke-ProductionSmokeTests; "Public routes, security headers, and unauthenticated worker denial passed." } "Stop promotion, keep Cron disabled, inspect sanitized logs, and roll back the Vercel deployment." | Out-Null
      Invoke-Check "Scheduler state" {
        Test-SchedulerStateReadOnly (Join-Path $EvidenceRoot "scheduler-state.json")
      } "Investigate unexpected scheduler state without deleting queue or document history." | Out-Null
      Add-Result "Automation Cron" "PASS" "Cron was not activated; separate secret verification and authorization remain mandatory."
    }
  }
} catch {
  $ReleaseStopped = $true
  if ($Blockers.Count -eq 0) { Add-Result "Release orchestration" "FAIL" $_.Exception.Message "Resolve the prerequisite and start a new evidence directory." }
} finally {
  Pop-Location
  $overall = Write-ReleaseReports
}

if ($overall -ne "PASS") { exit 1 }
