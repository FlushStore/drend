# Liga o vault ao vivo no DREND: uma tarefa do Windows, a cada 5 minutos, manda as notas
# que mudaram direto da pasta do Obsidian (sem esperar o push para o GitHub).
# Uso (PowerShell, na pasta do drend):
#   .\scripts\vault-pc.ps1 -Vault segundo-cerebro -Pasta "C:\Users\rapha\Desktop\ObsidianSegundoCerebro"
# Antes: [Environment]::SetEnvironmentVariable("DREND_VAULT_TOKEN", "<token>", "User")
# Para desligar: Unregister-ScheduledTask -TaskName "DREND vault <vault>" -Confirm:$false
param(
  [Parameter(Mandatory)][ValidateSet("segundo-cerebro", "rapha-os-business")][string]$Vault,
  [Parameter(Mandatory)][string]$Pasta,
  [int]$Minutos = 5
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $Pasta)) { throw "Pasta não encontrada: $Pasta" }
if (-not [Environment]::GetEnvironmentVariable("DREND_VAULT_TOKEN", "User")) { throw "Falta DREND_VAULT_TOKEN nas variáveis do usuário." }
# Caminho curto (C:\PROGRA~1\...): com espaço no caminho, o conhost --headless falha calado.
$node = (New-Object -ComObject Scripting.FileSystemObject).GetFile((Get-Command node).Source).ShortPath
$script = Join-Path $PSScriptRoot "vault-enviar.mjs"
$log = Join-Path $env:USERPROFILE ".drend-vault-$Vault.log"

# conhost --headless roda o node sem abrir janela a cada 5 minutos.
$argumento = "--headless cmd /c `"`"$node`" `"$script`" $Vault `"$Pasta`" --se-mudou >> `"$log`" 2>&1`""
$acao = New-ScheduledTaskAction -Execute "conhost.exe" -Argument $argumento -WorkingDirectory (Split-Path $PSScriptRoot)
$quando = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $Minutos)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "DREND vault $Vault" -Action $acao -Trigger $quando -Settings $ajustes -Force | Out-Null

# Primeira rodada agora, para conferir (o token recém-gravado ainda não está nesta janela).
$env:DREND_VAULT_TOKEN = [Environment]::GetEnvironmentVariable("DREND_VAULT_TOKEN", "User")
& $node $script $Vault $Pasta
Write-Host "Pronto: '$Vault' vai para o DREND a cada $Minutos min (log em $log)."
