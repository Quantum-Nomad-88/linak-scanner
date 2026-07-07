$sql = Get-Content -Raw -Path "$PSScriptRoot\..\supabase\bootstrap-ready.sql"
Set-Clipboard -Value $sql
Write-Host "SQL copied to clipboard."
Write-Host "Opening Supabase SQL Editor and Storage..."
Start-Process "https://supabase.com/dashboard/project/awmwsatggebkiwqvqkfm/sql/new"
Start-Sleep -Seconds 1
Start-Process "https://supabase.com/dashboard/project/awmwsatggebkiwqvqkfm/storage/buckets"
Write-Host ""
Write-Host "1. Paste SQL in the editor and click Run"
Write-Host "2. Create bucket test-setup-records (PRIVATE) if it does not exist"
