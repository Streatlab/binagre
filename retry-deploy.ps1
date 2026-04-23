$ErrorActionPreference = 'Continue'
$log = 'C:\streatlab-erp\retry-deploy.log'
"=== Retry deploy iter6 kit visual  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $log -Append -Encoding utf8
Set-Location 'C:\streatlab-erp'

"---- git pull origin master ----" | Out-File -FilePath $log -Append -Encoding utf8
& git pull origin master 2>&1 | Out-File -FilePath $log -Append -Encoding utf8

"---- npx vercel --prod ----" | Out-File -FilePath $log -Append -Encoding utf8
& npx vercel --prod --yes 2>&1 | Out-File -FilePath $log -Append -Encoding utf8

"=== End $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $log -Append -Encoding utf8
