-- DREND · Um cérebro só (13/11/2026): o vault "rapha-os-business" foi aposentado e o
-- conteúdo dele já está no ObsidianUnificado (vault "segundo-cerebro"). Tira as notas
-- antigas e a linha de leitura desse vault. A 0005_vault.sql fica como histórico.
-- Backup das linhas apagadas: C:\Users\rapha\Backups\drend-rapha-os-business-2026-11-13.json

delete from public.drend_vault where vault = 'rapha-os-business';
delete from public.drend_vault_leitura where vault = 'rapha-os-business';
