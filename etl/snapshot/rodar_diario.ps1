# Rotina diaria do snapshot da Vercel (agendada no Agendador de Tarefas do Windows).
# Gera o snapshot a partir do DW e publica na branch `vercel` com o codigo da `main` do GitHub.
# Precisa de: rede/VPN que alcance o DW (10.193.1.252), backend/.env, node, python (py -3), git
# com credencial salva para o GitHub. Se o DW estiver inalcancavel, a geracao falha ANTES de
# publicar e o site segue com o snapshot anterior. Log em etl/snapshot/logs/ (ultimos 30).
$ErrorActionPreference = "Continue"
$raiz = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$logs = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force $logs | Out-Null
$log = Join-Path $logs ("snapshot_{0:yyyy-MM-dd_HHmm}.log" -f (Get-Date))
Set-Location $raiz
$env:PYTHONIOENCODING = "utf-8"
"Inicio: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" | Out-File $log -Encoding utf8
& py -3 etl/snapshot/publicar_snapshot.py --base origin/main *>&1 | Out-File $log -Append -Encoding utf8
$codigo = $LASTEXITCODE
"Fim: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') | codigo de saida $codigo" | Out-File $log -Append -Encoding utf8
Get-ChildItem $logs -Filter "snapshot_*.log" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
exit $codigo
