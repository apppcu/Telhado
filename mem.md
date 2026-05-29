# Memoria Operacional - Controle Telhado

## Estado Atual

- Data do ponto de parada: 2026-05-29.
- Branch para continuar: `dev-2026-05-30`.
- Ultimo commit funcional entregue na main: `594a2f7 gps on`.
- Commits docs na dev: `e772f27 docs: atualiza ponto de parada`, `503b7a5 docs: atualiza readme`.
- `main` ja recebeu `gps on` e foi enviada ao GitHub.
- `dev-2026-05-30` ja foi enviada ao GitHub.

## Arquitetura

- App Flutter APK offline-first em `app/`.
- Backend 100% Google Apps Script em `gas/`.
- Persistencia principal no Google Sheets.
- Fotos no Google Drive.
- Flutter nunca acessa Sheets/Drive direto.
- Fluxo correto: Flutter -> GAS -> Sheets/Drive.
- Fila offline local em SQLite; sync manda pendencias quando houver internet.

## IDs e URLs

- Planilha principal: `1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ`.
- Script GAS: `1uBHnZ1xnzE00dXMqHDfxcrXC5p9Lm06-l9cecTTfoPr8irzLz6_bWBKZ`.
- Conta corporativa do projeto: `apppcu@uel.br`.
- Pasta Drive antiga no `config.gs`: `197iqHWkSoFRKYKrckPhhTfLvuctBhMg_`.
- Essa pasta antiga deu 404 para o usuario.
- Pasta indicada pelo usuario para verificar amanha: `1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm`.
- Nao trocar o `DRIVE_ROOT_FOLDER_ID` sem confirmar com o usuario.

## Arquivos Mais Importantes

- App principal: `app/lib/main.dart`.
- Login: `app/lib/pages/login_page.dart`.
- Lista de servicos: `app/lib/pages/chamados_page.dart`.
- Detalhe do chamado: `app/lib/pages/chamado_detalhe_page.dart`.
- API mobile: `app/lib/services/api_service.dart`.
- Banco local/fila: `app/lib/services/local_db_service.dart`.
- Sync offline: `app/lib/services/sync_service.dart`.
- Fotos locais: `app/lib/services/camera_service.dart`.
- GPS app: `app/lib/services/location_service.dart`.
- GAS chamados: `gas/src/chamados.gs`.
- GAS fotos/Drive: `gas/src/drive.gs`.
- GAS schema/install: `gas/src/installer.gs`.
- GAS config: `gas/src/config.gs`.

## Fluxo Correto da Tela de Servico

A tela principal do servico deve mostrar os dados do chamado e somente estes botoes:

```text
Nova Vistoria
Concluir Reparo
Foto Final
Encerrar Servico
```

Nao colocar na tela principal:

- `Execucao do reparo`;
- `Servico executado`;
- `Observacao final`;
- textos explicando a ordem do fluxo.

Esses campos aparecem somente dentro do pop-up do botao `Concluir Reparo`.

## Regras do Fluxo Mobile

- `Nova Vistoria` primeiro abre pop-up pedindo justificativa.
- Depois da justificativa, mostra apenas `Materiais necessarios` e `Ferramentas ou equipe necessaria`.
- Justificativa entra como observacao da nova vistoria.
- Nova vistoria nao bloqueia `Concluir Reparo`.
- `Concluir Reparo` pode ser acessado sem nova vistoria.
- Se status for `EM_ANALISE`, `Concluir Reparo` inicia reparo e abre pop-up.
- `Concluir Reparo` registra `Servico executado` e `Observacao final` localmente.
- `Foto Final` so funciona depois de concluir reparo.
- `Encerrar Servico` so funciona depois de foto final.
- Foto final deve ficar pendente e sincronizar junto com o encerramento.

## Offline/Login

- Login salva sessao para nao digitar usuario/senha sempre.
- Botao `Sair` limpa sessao salva.
- App pode abrir em modo offline se houver sessao valida salva.
- Chamados concluidos devem sumir da lista do tecnico.

## GPS

- Dependencia Flutter: `geolocator`.
- Android manifest recebeu permissoes de localizacao.
- Servico: `LocationService`.
- GPS entra nos payloads de vistoria, reparo, conclusao, nova vistoria e upload de fotos.
- Se GPS falhar, enviar `gps_disponivel: false` com motivo.

## Aba GPS no Sheets

Aba: `gps_chamado`.

Colunas:

```text
id, chamado_id, usuario_id, acao, origem, gps_disponivel,
latitude, longitude, precisao_metros, gps_capturado_em,
gps_motivo, created_at
```

Funcao manual adicionada no GAS:

```javascript
criarAbaGpsChamadoUmaVez()
```

Arquivo: `gas/src/installer.gs`.

## Fotos

- Foto nao fica na planilha.
- Arquivo da imagem fica no Drive.
- Planilha guarda metadados/link na aba `fotos_chamado`.
- Caminho atual no codigo:

```text
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/vistoria
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/conclusao
```

- Pendencia para amanha: confirmar qual pasta raiz do Drive usar.
- Arquivo para trocar pasta raiz: `gas/src/config.gs`.

## Design do APK

- Foi feita geral visual no APK com tema global.
- Botao, card, campo e AppBar padronizados.
- Login, lista de chamados e detalhe do chamado foram melhorados.
- Nao sacrificar fluxo por estetica.
- UI de campo: simples, alto contraste, botoes grandes.

## Validacoes Recentes

- `flutter analyze` passou sem erros.
- `node --check` passou nos arquivos GAS alterados.
- `dart format` travou no ambiente; nao insistir sem necessidade.

## Preferencias do Usuario

- Antes de mexer em fluxo de tela, explicar claramente o que foi entendido.
- Nao escrever codigo quando o usuario pedir primeiro entendimento.
- Nao adicionar texto/campo extra na tela principal do servico.
- Nao executar `clasp.cmd push` automaticamente.
- Se o usuario pedir explicitamente `clasp push`, pode executar.
- Usuario prefere solucao direta e pouca enrolacao.

## Proximo Assunto Provavel

- Resolver pasta correta das fotos no Drive.
- Confirmar se `DRIVE_ROOT_FOLDER_ID` deve virar `1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm`.
- Depois publicar no GAS somente se o usuario pedir.
