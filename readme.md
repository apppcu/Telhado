# Controle Telhado

Sistema institucional para abertura, encaminhamento, execução e acompanhamento de chamados de telhados da UEL.

## Estado atual

- App Flutter offline-first para técnicos em campo.
- Backend e dashboard em Google Apps Script.
- Dados no Google Sheets.
- Fotos no Google Drive via GAS.
- Clima via Open-Meteo.
- Deployment público do GAS: `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA`.
- Publicação: Codex executa `clasp.cmd push --force`; o deploy da nova versão é feito manualmente pelo usuário.
- Último commit existente: `0228608 refactor: reutiliza contexto mobile de chamados`.
- Há alterações locais ainda não commitadas.

## Arquitetura

```text
Flutter APK -> Google Apps Script -> Google Sheets / Drive / Gmail
Dashboard Web -> Google Apps Script -> Google Sheets / Drive / Open-Meteo
```

Regra principal: o Flutter nunca acessa Sheets ou Drive diretamente. Toda operação passa pelo GAS.

## Módulos

```text
app/        App Flutter do técnico
gas/        Google Apps Script, API e dashboard HTML Service
docs/       Documentação técnica
sheets/     Schema e seed das planilhas
prd.md      Documento de produto
mem.md      Memória operacional curta
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
2. Admin/gestor encaminha o chamado para manutenção.
3. Técnico acessa o APK e vê apenas seus serviços.
4. Técnico registra vistoria com foto inicial e materiais necessários.
5. Técnico registra reparo, foto final e encerra o serviço.
6. GAS sincroniza dados, fotos, histórico e status.
7. Dashboard exibe métricas, chamados recentes, relatórios, peças e previsão de chuva.

## Status principais

```text
ABERTO
ENCAMINHADO
EM_ANALISE
EM_EXECUCAO
CONCLUIDO
```

## Regras do APK

- Tela do serviço mostra apenas os botões principais:
  `Nova Vistoria`, `Concluir Reparo`, `Foto Final`, `Encerrar Serviço`.
- `Nova Vistoria` exige justificativa.
- Campos de texto de vistoria e reparo são opcionais.
- Foto antes é obrigatória para vistoria normal.
- Foto final é obrigatória para encerrar.
- GPS entra nos payloads quando disponível.
- Ações e fotos são salvas localmente primeiro; o envio ocorre em segundo plano.
- Cada vistoria envia `vistoria_token` para evitar duplicação no GAS.
- Pendências offline usam o token atual da sessão ao sincronizar.
- Pendência antiga com `CHAMADO_NAO_ENCONTRADO` é descartada para destravar a fila.
- Cache local remove chamados concluídos.
- Status são normalizados sem acentos para impedir que `Concluído` reapareça offline como `ABERTO`.

## Dashboard GAS

- Login com conta institucional.
- Menu lateral organizado em `Principal`, `Cadastros` e `Operacional`.
- Admin vê `Chamados`, `Usuários`, `Técnicos`, `Relatório` e `Peças`.
- Cadastro de usuários permite criar, listar, filtrar, bloquear, alterar e excluir acessos.
- `Chamados recentes` abre com status `Aberto`.
- Exportação fica no botão `Relatório`, com CSV, Excel `.xls` e PDF.
- `Gerenciar chamado` encaminha direto para manutenção; não há botão separado de salvar.
- Widget de clima mostra temperatura atual, chuva prevista e ícone visual.
- Dashboard atualiza automaticamente a cada 10 minutos.

## Peças por chamado

- Cada vistoria gera uma lista de materiais independente.
- Um mesmo chamado pode ter duas ou mais listas de peças.
- A tela `Peças` agrupa as listas por chamado e setor de consumo.
- Exportação disponível por vistoria e consolidada por chamado em PDF e Excel `.xls`.
- Novas listas são gravadas na aba `pecas_vistoria`.
- Chamados antigos usam fallback de leitura das observações registradas.
- O fallback preserva materiais multilinha, como vigas, telhas, parafusos e PU.
- Itens legados são exibidos como somente leitura.

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
clasp.cmd deploy -i <deployment_id> -V <versao> -d "descricao"
```

O `dart format` travou neste ambiente anteriormente; evitar repetir sem necessidade.

## Validação

```bash
cd app
flutter analyze --no-pub
```

Para validar o offline: atualizar a lista online, desligar a internet e confirmar que chamados `CONCLUIDO` não reaparecem.

## Referências

- [PRD](./prd.md)
- [Arquitetura](./docs/arquitetura.md)
- [API](./docs/api.md)
- [Planilhas](./docs/planilhas.md)
- [Schema Sheets](./sheets/schema.md)

Última atualização: 2026-05-31.
