# Memoria Operacional - Controle Telhado

## Estado

- Data: 2026-05-29.
- Branch: `dev-2026-05-30`.
- Ultimo commit: `63debd6 Ajusta fluxo tecnico e relatorios GAS`.
- Worktree estava limpo apos o commit acima.
- Usuario prefere respostas diretas e pouca enrolacao.

## IDs

- Planilha: `1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ`.
- Script GAS: `1uBHnZ1xnzE00dXMqHDfxcrXC5p9Lm06-l9cecTTfoPr8irzLz6_bWBKZ`.
- Web app/API: `https://script.google.com/macros/s/AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA/exec`.
- Deployment: `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA`.
- Versao GAS publicada: `78 - relatorio de chamados`.
- Conta corporativa: `apppcu@uel.br`.
- Pasta Drive correta: `1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm`.

## Arquitetura

- Flutter APK offline-first em `app/`.
- GAS em `gas/` com API e dashboard.
- Sheets guarda dados; Drive guarda fotos.
- Flutter nunca acessa Sheets/Drive direto.
- Fluxo: Flutter -> GAS -> Sheets/Drive.
- Fila offline local em SQLite.

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

## Fluxo mobile

- Tela do servico mostra apenas: `Nova Vistoria`, `Concluir Reparo`, `Foto Final`, `Encerrar Servico`.
- Nao colocar textos explicando ordem do fluxo na tela principal.
- Nao mostrar campos fixos de execucao/reparo na tela principal.
- `Nova Vistoria` primeiro pede justificativa.
- Depois mostra apenas `Materiais necessarios`.
- Justificativa vira observacao da nova vistoria.
- Nova vistoria nao bloqueia `Concluir Reparo`.
- `Concluir Reparo` pode iniciar reparo se status for `EM_ANALISE`.
- Campos de texto de vistoria/reparo sao opcionais.
- Foto antes obrigatoria na vistoria normal.
- Foto final obrigatoria antes de encerrar.
- GPS entra no payload quando disponivel.

## Sync/offline

- Login salva sessao.
- `Sair` limpa sessao.
- App pode abrir offline se houver sessao valida.
- Pendencias usam token atual da sessao ao sincronizar.
- `CHAMADO_NAO_ENCONTRADO` em pendencia antiga deve destravar fila.
- Encerramento mobile no GAS aceita `ENCAMINHADO`, `EM_ANALISE` ou `EM_EXECUCAO`.
- Encerramento ja `CONCLUIDO` deve ser idempotente.

## Dashboard GAS

- `Chamados recentes` abre com status `Aberto`.
- Exportacao saiu de `Chamados recentes`.
- Botao `Relatorio` exporta CSV, Excel `.xls` e PDF.
- `Gerenciar chamado` nao tem observacao tecnica nem salvar separado.
- `Enviar para manutencao` salva e encaminha direto.
- Clima mostra chuva, temperatura atual e icone sol/nuvem/chuva.

## Fotos

- Foto nao fica na planilha.
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

Funcao manual: `criarAbaGpsChamadoUmaVez()` em `gas/src/installer.gs`.

## Validacoes

- `flutter analyze` passou sem erros apos ajustes do APK.
- `node --check` do script extraido de `gas/src/index.html` passou.
- `dart format` travou no ambiente; nao insistir sem necessidade.
- `clasp.cmd push` pode ser usado quando precisar publicar GAS.

## Proximo provavel

- Testar online relatorio/dashboard.
- Testar upload real de foto no APK.
