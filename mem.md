# Memória Operacional - Controle Telhado

## Estado

- Data: 2026-05-31.
- Branch atual: `segunda`.
- Último commit existente: `0228608 refactor: reutiliza contexto mobile de chamados`.
- Há alterações locais ainda não commitadas no APK, GAS e documentação.
- Usuário prefere respostas diretas e pouca enrolação.

## IDs

- Planilha: `1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ`.
- Script GAS: `1uBHnZ1xnzE00dXMqHDfxcrXC5p9Lm06-l9cecTTfoPr8irzLz6_bWBKZ`.
- Web app/API: `https://script.google.com/macros/s/AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA/exec`.
- Deployment: `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA`.
- Versão GAS publicada: confirmar no Apps Script após deploy manual.
- Não assumir número de versão publicada: confirmar no Apps Script após cada deploy manual.
- Fluxo combinado: Codex executa `clasp.cmd push --force`; usuário faz o deploy manual.
- Conta corporativa: `apppcu@uel.br`.
- Pasta Drive correta: `1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm`.

## Arquitetura

- Flutter APK offline-first em `app/`.
- GAS em `gas/` com API e dashboard.
- Sheets guarda dados; Drive guarda fotos.
- Flutter nunca acessa Sheets/Drive direto.
- Fluxo: Flutter -> GAS -> Sheets/Drive.
- Fila offline local em SQLite.
- Dashboard web atualiza automaticamente a cada 10 minutos.

## Arquivos-chave

- App: `app/lib/main.dart`.
- Login: `app/lib/pages/login_page.dart`.
- Lista: `app/lib/pages/chamados_page.dart`.
- Detalhe: `app/lib/pages/chamado_detalhe_page.dart`.
- API: `app/lib/services/api_service.dart`.
- Sync: `app/lib/services/sync_service.dart`.
- DB local: `app/lib/services/local_db_service.dart`.
- Fotos: `app/lib/services/camera_service.dart`.
- GPS: `app/lib/services/location_service.dart`.
- GAS chamados: `gas/src/chamados.gs`.
- GAS Drive: `gas/src/drive.gs`.
- GAS dashboard: `gas/src/index.html`, `gas/src/dashboard.gs`.
- Config: `gas/src/config.gs`.

## Fluxo Mobile

- Tela do serviço mostra apenas: `Nova Vistoria`, `Concluir Reparo`, `Foto Final`, `Encerrar Serviço`.
- Não colocar textos explicando ordem do fluxo na tela principal.
- Não mostrar campos fixos de execução/reparo na tela principal.
- `Nova Vistoria` primeiro pede justificativa.
- Depois mostra apenas `Materiais necessários`.
- Justificativa vira observação da nova vistoria.
- Nova vistoria não bloqueia `Concluir Reparo`.
- `Concluir Reparo` pode iniciar reparo se status for `EM_ANALISE`.
- Campos de texto de vistoria/reparo são opcionais.
- Foto antes obrigatória na vistoria normal.
- Foto final obrigatória antes de encerrar.
- GPS entra no payload quando disponível.
- Salvamento de ações e fotos prioriza cache local; sincronização ocorre em segundo plano para reduzir espera.
- Cada vistoria envia `vistoria_token` para evitar duplicação no GAS.

## Sync/Offline

- Login salva sessão.
- `Sair` limpa sessão.
- App pode abrir offline se houver sessão válida.
- Pendências usam token atual da sessão ao sincronizar.
- `CHAMADO_NAO_ENCONTRADO` em pendência antiga deve destravar fila.
- Encerramento mobile no GAS aceita `ENCAMINHADO`, `EM_ANALISE` ou `EM_EXECUCAO`.
- Encerramento já `CONCLUIDO` deve ser idempotente.
- Cache local remove chamados concluídos.
- Normalização de status no APK remove acentos: `Concluído` não pode reaparecer offline como `ABERTO`.

## Dashboard GAS

- `Chamados recentes` abre com status `Aberto`.
- Menu lateral organizado em `Principal`, `Cadastros` e `Operacional`.
- Botões laterais: `Chamados`, `Usuários`, `Técnicos`, `Relatório`, `Peças`.
- Usuários podem ser criados, listados, filtrados, bloqueados, alterados ou excluídos.
- Exportação saiu de `Chamados recentes`.
- Botão `Relatório` exporta CSV, Excel `.xls` e PDF.
- `Gerenciar chamado` não tem observação técnica nem salvar separado.
- `Enviar para manutenção` salva e encaminha direto.
- Clima mostra chuva, temperatura atual e ícone sol/nuvem/chuva.
- Dashboard atualiza automaticamente a cada 10 minutos.

## Peças

- Tela lateral `Peças` agrupa solicitações por chamado.
- Cada vistoria gera uma lista independente; um chamado pode ter várias listas.
- Exportação disponível por vistoria e consolidada por chamado em PDF e Excel `.xls`.
- Aba Sheets: `pecas_vistoria`.
- Novas vistorias gravam dados estruturados na aba usando `vistoria_token`.
- Chamados antigos usam fallback de leitura das observações já registradas.
- O fallback aceita materiais multilinha, por exemplo vigas, telhas, parafusos e PU em linhas separadas.
- Itens legados aparecem como somente leitura, pois não possuem linha estruturada em `pecas_vistoria`.

## Fotos

- Foto não fica na planilha.
- Planilha guarda metadados/link em `fotos_chamado`.
- Caminhos:

```text
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/vistoria
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/conclusao
```

## GPS Sheets

Aba `gps_chamado`:

```text
id, chamado_id, usuario_id, acao, origem, gps_disponivel,
latitude, longitude, precisao_metros, gps_capturado_em,
gps_motivo, created_at
```

Função manual: `criarAbaGpsChamadoUmaVez()` em `gas/src/installer.gs`.

## Validações

- `flutter analyze --no-pub` passou sem erros após o ajuste offline do APK em 2026-05-31.
- `node --check` do script extraído de `gas/src/index.html` passou.
- Verificação de sintaxe de todos os `.gs` passou após o módulo Peças.
- `dart format` travou no ambiente; não insistir sem necessidade.
- Último `clasp.cmd push --force` do GAS executado em 2026-05-31 às 15:04:35.
- Deploy GAS continua manual pelo usuário.

## Segurança

- Hardening publicado originalmente no deployment público como versão `82`.
- Rota legada anônima `GET ?action=chamados` removida e validada em produção.
- Login técnico bloqueia por aproximadamente 15 minutos após 5 falhas.
- Token mobile sem expiração válida deve ser rejeitado.
- Upload aceita apenas JPEG válido de até 6 MB e tipos conhecidos.
- Dashboard não permite mais iframe externo.
- Link pós-chuva exige confirmação POST e links novos expiram em 30 dias.

## Próximo Provável

- Gerar novo APK com o ajuste offline e validar: abrir online, atualizar, desligar internet e confirmar que chamados concluídos não reaparecem.
- Após deploy manual do GAS, validar `Peças` com materiais multilinha.
- Testar exportação PDF e Excel do pedido consolidado por chamado.
- Revisar alterações locais e criar commit quando os testes finais passarem.
