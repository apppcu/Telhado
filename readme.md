# Controle Telhado

Sistema institucional para abertura, encaminhamento, execucao e acompanhamento de chamados de telhados da UEL.

## Estado atual

- App Flutter offline-first para tecnicos em campo.
- Backend e dashboard em Google Apps Script.
- Dados no Google Sheets.
- Fotos no Google Drive via GAS.
- Clima via Open-Meteo.
- Deployment publico atual do GAS: `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA`.
- Versao GAS publicada: `78 - relatorio de chamados`.
- Ultimo commit funcional: `63debd6 Ajusta fluxo tecnico e relatorios GAS`.

## Arquitetura

```text
Flutter APK -> Google Apps Script -> Google Sheets / Drive / Gmail
Dashboard Web -> Google Apps Script -> Google Sheets / Drive / Open-Meteo
```

Regra principal: o Flutter nunca acessa Sheets ou Drive diretamente. Toda operacao passa pelo GAS.

## Modulos

```text
app/        App Flutter do tecnico
gas/        Google Apps Script, API e dashboard HTML Service
docs/       Documentacao tecnica
sheets/     Schema e seed das planilhas
prd.md      Documento de produto
mem.md      Memoria operacional curta
```

Arquivos mais usados:

- `app/lib/pages/login_page.dart`
- `app/lib/pages/chamados_page.dart`
- `app/lib/pages/chamado_detalhe_page.dart`
- `app/lib/services/api_service.dart`
- `app/lib/services/sync_service.dart`
- `app/lib/services/local_db_service.dart`
- `gas/src/index.html`
- `gas/src/chamados.gs`
- `gas/src/drive.gs`
- `gas/src/dashboard.gs`
- `gas/src/config.gs`

## Fluxo do chamado

1. Solicitante abre chamado no dashboard web.
2. Admin/gestor encaminha o chamado para manutencao.
3. Tecnico acessa o APK e ve apenas seus servicos.
4. Tecnico registra vistoria com foto inicial.
5. Tecnico registra reparo, foto final e encerra o servico.
6. GAS sincroniza dados, fotos, historico e status.
7. Dashboard exibe metricas, chamados recentes, relatorios e previsao de chuva.

## Status principais

```text
ABERTO
ENCAMINHADO
EM_ANALISE
EM_EXECUCAO
CONCLUIDO
```

## Regras do APK

- Tela do servico mostra apenas os botoes principais:
  `Nova Vistoria`, `Concluir Reparo`, `Foto Final`, `Encerrar Servico`.
- `Nova Vistoria` exige justificativa.
- Campos de texto de vistoria e reparo sao opcionais.
- Foto antes e obrigatoria para vistoria normal.
- Foto final e obrigatoria para encerrar.
- GPS entra nos payloads quando disponivel.
- Pendencias offline usam o token atual da sessao ao sincronizar.
- Pendencia antiga com `CHAMADO_NAO_ENCONTRADO` e descartada para destravar a fila.

## Dashboard GAS

- Login com conta institucional.
- Admin ve chamados recentes, tecnicos, solicitacoes pendentes e relatorio.
- `Chamados recentes` abre com status `Aberto`.
- Exportacao fica no botao `Relatorio`, com CSV, Excel `.xls` e PDF.
- `Gerenciar chamado` encaminha direto para manutencao; nao ha botao separado de salvar.
- Widget de clima mostra temperatura atual, chuva prevista e icone visual.

## Drive e fotos

Pasta raiz confirmada:

```text
1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm
```

Caminho usado:

```text
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/vistoria
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/conclusao
```

A planilha guarda metadados e links na aba `fotos_chamado`; a imagem fica no Drive.

## Desenvolvimento

Flutter:

```bash
cd app
flutter pub get
flutter analyze
```

Google Apps Script:

```bash
cd gas
clasp.cmd push --force
clasp.cmd version "descricao"
clasp.cmd redeploy <deployment_id> -V <versao> -d "descricao"
```

O `dart format` travou neste ambiente anteriormente; evitar repetir sem necessidade.

## Referencias

- [PRD](./prd.md)
- [Arquitetura](./docs/arquitetura.md)
- [API](./docs/api.md)
- [Planilhas](./docs/planilhas.md)
- [Schema Sheets](./sheets/schema.md)

Ultima atualizacao: 2026-05-29.
