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
- Pasta correta confirmada pelo usuario e aplicada no `config.gs`: `1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm`.
- GAS publicado depois da correcao da pasta: deployment do APK `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA` atualizado para versao 72.
- Diagnostico posterior: fila mobile pode guardar token antigo em pendencias. App passou a reenviar pendencias usando token atual da sessao, e GAS passou a aceitar encerramento mobile vindo de `ENCAMINHADO`, `EM_ANALISE` ou `EM_EXECUCAO` quando o tecnico logado e o responsavel.
- GAS publicado depois desse ajuste: deployment do APK `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA` atualizado para versao 73.
- Ajuste seguinte: encerramento mobile ficou idempotente no GAS. Se uma pendencia antiga tentar concluir chamado ja `CONCLUIDO`, o GAS retorna sucesso para destravar a fila. Deployment do APK atualizado para versao 74.
- Regra de campos do fluxo mobile: em vistoria/reparo, textos sao opcionais. Obrigatorios: justificativa em `Nova Vistoria`, foto antes para salvar vistoria normal no APK, e foto final para encerrar servico. GAS publicado com campos opcionais no deployment do APK versao 75.
- App passou a descartar automaticamente pendencia local quando o GAS retorna `CHAMADO_NAO_ENCONTRADO`, para nao travar a fila depois que um chamado foi apagado manualmente da planilha.
- APK: remover da tela de vistoria os itens `Ferramentas ou equipe necessaria` e `Resolver na hora`. Manter os botoes principais inalterados.
- Dashboard GAS: widget de clima passou a mostrar temperatura atual, condicao visual e icone CSS de sol/nuvem/chuva. Deployment do APK/painel atualizado para versao 76.
- Dashboard GAS: modal `Gerenciar chamado` removeu `Observacao tecnica` e `Salvar alteracao`; status ficou informativo e `Enviar para manutencao` salva/encaminha direto. Deployment atualizado para versao 77.

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
- Depois da justificativa, mostra apenas `Materiais necessarios`.
- Justificativa entra como observacao da nova vistoria.
- Nova vistoria nao bloqueia `Concluir Reparo`.
- `Concluir Reparo` pode ser acessado sem nova vistoria.
- Se status for `EM_ANALISE`, `Concluir Reparo` inicia reparo e abre pop-up.
- `Concluir Reparo` registra `Servico executado` e `Observacao final` localmente quando informados; os campos sao opcionais.
- `Foto Final` so funciona depois de concluir reparo.
- `Encerrar Servico` so funciona depois de foto final.
- Foto final deve ficar pendente e sincronizar junto com o encerramento.
- Foto antes e obrigatoria para salvar vistoria normal no APK.

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

- Pasta raiz do Drive corrigida em `gas/src/config.gs`.

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
- `clasp.cmd push` pode ser executado quando for necessario publicar alteracoes no GAS.
- Usuario prefere solucao direta e pouca enrolacao.

## Dashboard GAS

- Deployment publico atual: `AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA`.
- Versao publicada atual: `78 - relatorio de chamados`.
- `Chamados recentes` abre com filtro de status em `Aberto`.
- Exportacao saiu de `Chamados recentes`.
- Novo botao lateral `Relatorio` para admin abre exportacao filtrada em CSV, Excel `.xls` e PDF via janela de impressao.
- Modal `Gerenciar chamado` nao tem observacao tecnica nem salvar alteracao; `Enviar para manutencao` ja salva/encaminha.

## Proximo Assunto Provavel

- Testar upload real de foto no APK depois da publicacao.
