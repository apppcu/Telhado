# 🌧️ Monitoramento Climático
# Objetivo
Monitorar eventos de chuva na Universidade Estadual de Londrina para identificar possíveis reincidências de vazamentos após reparos executados nos telhados.
Objetivos:
- validar eficiência dos reparos;
- detectar falhas pós-chuva;
- automatizar alertas;
- gerar histórico climático;
- apoiar manutenção preventiva.
---
# API Climática
## Serviço
Open-Meteo
Site:
https://open-meteo.com/
---
# Endpoint
```text
https://api.open-meteo.com/v1/forecast
```
---
# Configuração Base
```text
Latitude: -23.3253
Longitude: -51.2000
Cidade: Londrina/PR
Timezone: America/Sao_Paulo
Variável: precipitation_sum
Unidade: mm
```
---
# Estratégia de Consulta
O sistema deverá consultar a precipitação acumulada do dia anterior utilizando:
```text
past_days=1
```
Objetivo:
- validar chuva ocorrida;
- evitar leitura de previsão futura.
---
# Exemplo de Requisição
```javascript
const url =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=-23.3253" +
  "&longitude=-51.2000" +
  "&daily=precipitation_sum" +
  "&past_days=1" +
  "&timezone=America/Sao_Paulo";
const response = UrlFetchApp.fetch(url);
const data = JSON.parse(
  response.getContentText()
);
```
---
# Exemplo de Resposta
```json
{
  "daily": {
    "time": ["2026-05-22"],
    "precipitation_sum": [12.4]
  }
}
```
---
# Autenticação
A API Open-Meteo não exige autenticação.
Limite estimado:
```text
Até 10.000 chamadas por dia
```
---
# Regras de Negócio
## Threshold Principal
```text
Precipitação ≥ 5 mm
```
Quando atingido o sistema deverá:
- localizar chamados recentes;
- identificar prédios impactados;
- criar validação técnica;
- enviar notificações;
- registrar evento climático.
---
# Janela de Validação
```text
Chamados concluídos nos últimos 30 dias
```
---
# Definição de Reincidência
```text
Novo vazamento no mesmo prédio
ou setor em até 90 dias
após conclusão do reparo.
```
---
# Classificação da Chuva
```text
5 mm   → LEVE
15 mm  → MODERADA
30 mm  → FORTE
50 mm  → CRITICA
```
---
# Fluxo Automático
```text
Trigger diário
↓
Consulta Open-Meteo
↓
Obtém precipitação
↓
Verifica threshold
↓
Busca chamados recentes
↓
Cria validações
↓
Envia notificações
↓
Registra logs
```
---
# Trigger Diário
## Horário
```text
06:00 da manhã
```
Objetivos:
- consultar clima antes do expediente;
- gerar alertas operacionais.
---
# Estrutura da Planilha

## eventos_chuva
```text
id
data_evento
volume_mm
nivel_alerta
origem_api
timezone
raw_response
processado
created_at
```
---
# Campos Importantes
## nivel_alerta
```text
LEVE
MODERADA
FORTE
CRITICA
```
---
## processado
```text
TRUE
FALSE
```
---
# Estratégia de Segurança
O sistema deverá:
- registrar falhas da API;
- evitar chamadas duplicadas;
- registrar logs;
- validar respostas inválidas;
- manter histórico climático.
---
# Estratégia de Logs
Registrar:
- horário da execução;
- volume identificado;
- falhas;
- notificações enviadas.
---
# Expansão Futura
- radar climático;
- previsão preventiva;
- IA para infiltração;
- dashboard climático;
- manutenção preditiva;
- integração IoT.
---
# Objetivo Final
Criar um módulo climático inteligente integrado ao sistema institucional de manutenção predial utilizando Google Workspace e Google Apps Script para automatizar validações pós-chuva e reduzir reincidências de vazamentos.

---

# Arquitetura Definida do Projeto

## Decisao Principal

O sistema devera usar arquitetura mobile offline-first para atender tecnicos em campo.

```text
Flutter APK offline-first
↓
Banco local no celular
↓
Fila de sincronizacao
↓
Google Apps Script Web App
↓
Google Sheets + Google Drive + Gmail + Calendar
```

---

## Restricao de Backend

O backend devera ser 100% baseado em Google Apps Script.

Nao utilizar:

```text
Supabase
Firebase
Backend externo
Servidor proprio
```

Regra:

```text
Flutter nunca acessa Sheets ou Drive diretamente.
Flutter comunica apenas com o Google Apps Script.
```

---

## App do Tecnico

O aplicativo Flutter devera funcionar mesmo sem internet.

Funcionalidades offline obrigatorias:

- visualizar chamados ja baixados;
- preencher texto da execucao;
- atualizar status;
- tirar fotos;
- anexar fotos;
- finalizar processo localmente;
- manter pendencias em fila de sincronizacao;
- enviar tudo ao Google quando a internet voltar.

---

## Backend Google Apps Script

O Google Apps Script sera responsavel por:

- receber dados do app via JSON;
- validar usuario e permissao;
- gravar chamados no Google Sheets;
- registrar historico;
- salvar fotos no Google Drive;
- enviar e-mails pelo Gmail;
- criar eventos ou lembretes no Calendar quando necessario;
- executar trigger diario de monitoramento climatico;
- consultar Open-Meteo;
- criar validacoes pos-chuva;
- registrar logs de sincronizacao.

---

## Banco Institucional

Persistencia principal:

```text
Google Sheets
```

Abas previstas:

```text
usuarios
predios
chamados
historico_chamado
fotos_chamado
eventos_chuva
validacoes_pos_chuva
sync_logs
```

---

## Armazenamento de Fotos

As fotos deverao ser armazenadas no Google Drive.

Estrutura sugerida:

```text
Sistema_Telhados/
  Chamados/
    CH-0001/
      abertura/
      execucao/
      conclusao/
  Relatorios/
  Backup/
```

---

## Sincronizacao Offline

O app devera manter uma fila local de operacoes pendentes.

Exemplos:

```text
criar_chamado
atualizar_status
registrar_execucao
enviar_foto
finalizar_chamado
```

Quando a internet voltar:

- o app envia a fila para o Apps Script;
- o Apps Script valida os dados;
- o Apps Script grava em Sheets e Drive;
- o app marca os itens como sincronizados;
- falhas permanecem pendentes para nova tentativa.

---

# Workspace Corporativo

## Conta do Projeto

E-mail corporativo que deve operar/publicar o projeto:

```text
apppcu@uel.br
```

Observacao:

```text
O repositorio GitHub pode estar em usuario/e-mail diferente. Nao confundir com a conta corporativa do projeto.
```

## Google Sheets

Planilha principal:

```text
https://docs.google.com/spreadsheets/d/1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ/edit?gid=0#gid=0
```

ID da planilha:

```text
1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ
```

## Google Apps Script

Projeto vinculado/criacao pelo Workspace:

```text
https://script.google.com/u/0/home/projects/create?parent=1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ&emtoken=AUvJqTU7e9z3EEUjCaoWi1tBsLDp%3A1779806575073
```

ID do script:

```text
1uBHnZ1xnzE00dXMqHDfxcrXC5p9Lm06-l9cecTTfoPr8irzLz6_bWBKZ
```

ID do projeto Apps Script:

```text
1uBHnZ1xnzE00dXMqHDfxcrXC5p9Lm06-l9cecTTfoPr8irzLz6_bWBKZ
```

## Prioridade Atual

Comecar pelo dashboard do painel web usando Google Apps Script HTML Service.

---

# Entrega do Painel Web - 2026-05-27

## Escopo Implementado

Foi implementado o primeiro fluxo operacional completo do painel web em Google Apps Script HTML Service.

Principais entregas:

- login institucional via conta UEL;
- cadastro de acesso pelo painel;
- ativacao de usuarios via aba `usuarios`;
- dashboard pos-login;
- card de previsao de chuva para Londrina/PR;
- abertura de chamados pelo painel web;
- listagem de chamados recentes;
- gerenciamento de status do chamado;
- historico visivel no modal do chamado;
- registro de auditoria na aba `historico_chamado`;
- seed/atualizacao de centros institucionais;
- perfis adicionais de acesso.

---

## Web App

O Apps Script passou a usar manifesto com configuracao de Web App:

```json
"webapp": {
  "executeAs": "USER_DEPLOYING",
  "access": "ANYONE_ANONYMOUS"
}
```

Com `USER_DEPLOYING`, o Apps Script executa com as permissoes da conta que fez o deploy. A planilha central nao deve ser compartilhada com edicao para tecnicos; o controle de acesso fica no proprio backend.

Motivo:

- executar como conta do deploy centraliza a permissao de escrita na planilha;
- tecnicos e usuarios finais nao precisam receber acesso direto de edicao aos dados;
- autenticacao/autorizacao continuam sendo validadas pelo backend antes de cada acao.

Ultima implantacao funcional:

```text
Versao 16 - historico visivel chamado 2026-05-27
```

URL:

```text
https://script.google.com/a/macros/uel.br/s/AKfycbzO6gN7sGzPuI3hlswYMq8IeLqnBQA_CtdOeH5yuH9fmxImYywfzAUcG2TfGvGGysmgWA/exec
```

---

## Autenticacao e Usuarios

A validacao do acesso usa:

```text
Session.getActiveUser().getEmail()
```

Regra:

- e-mail precisa terminar com `@uel.br`;
- e-mail precisa existir na aba `usuarios`;
- coluna `ativo` precisa estar `TRUE`.

Foi adicionado diagnostico temporario de sessao para identificar:

- conta detectada;
- usuario encontrado na planilha;
- status ativo/inativo.

Observacao tecnica:

- datas vindas do Google Sheets precisam ser normalizadas para texto antes de retornar via `google.script.run`;
- a funcao `normalizeSheetValue_` foi adicionada para evitar erro de serializacao.

---

## Dashboard Pos-Login

O dashboard exibe:

- chamados abertos;
- chamados em execucao;
- chamados concluidos;
- alertas de chuva;
- lista de chamados recentes;
- previsao de chuva;
- solicitacoes pendentes para perfis administrativos.

Servico criado:

```text
gas/src/dashboard.gs
```

Funcao principal:

```javascript
getDashboardData()
```

---

## Previsao do Tempo

O dashboard consulta Open-Meteo para os proximos 4 dias.

Arquivo:

```text
gas/src/clima.gs
```

Configuracao atual:

```text
Latitude: -23.3045
Longitude: -51.1696
Timezone: America/Sao_Paulo
Variavel: precipitation_sum
forecast_days=4
```

Risco operacional:

```text
BAIXO: abaixo do threshold
ATENCAO: igual ou acima do threshold
CRITICO: igual ou acima de 2x threshold
```

Threshold atual:

```text
5 mm
```

---

## Chamados

Arquivo principal:

```text
gas/src/chamados.gs
```

Funcionalidades implementadas:

- `listarChamados()`;
- `criarChamado(payload)`;
- `atualizarChamado(item)`;
- `getHistoricoChamado(chamadoId)`.

Criacao de chamado:

- gera ID `CHAM-<uuid>`;
- gera numero sequencial `CH-000001`;
- grava na aba `chamados`;
- registra abertura na aba `historico_chamado`;
- atualiza dashboard apos salvar.

Status suportados:

```text
ABERTO
EM_ANALISE
EM_EXECUCAO
CONCLUIDO
```

Ao concluir:

- grava `data_fechamento` se ainda estiver vazia;
- registra alteracao no historico.

---

## Historico de Chamados

O modal `Gerenciar chamado` agora mostra uma linha do tempo com:

- acao;
- data/hora;
- status anterior;
- status novo;
- observacao;
- usuario.

Aba usada:

```text
historico_chamado
```

Acoes atuais:

```text
ABERTURA
ALTERACAO_STATUS
```

---

## Centros e Perfis

Foram adicionados ao seed:

Pro-Reitorias:

```text
PROGRAD
PRORH
PROAF
PROEX
PROPPG
PROPLAN
PROAE
```

PCU e diretorias:

```text
PCU
DSG
DOM
DME
```

Centros corrigidos:

```text
CESA -> CCSA
CLCH -> CCH
```

Perfis adicionados:

```text
CHEFE_DIVISAO
DIRETOR_CENTRO
```

Funcao de manutencao:

```javascript
atualizarCentrosInstitucionais()
```

Arquivo:

```text
gas/src/installer.gs
```

---

## Observacoes de Deploy

O `clasp deploy` so passou a gerar URL de Web App correta depois da inclusao da secao `webapp` no `appsscript.json`.

URLs com `/library/d/...` indicam implantacao como biblioteca, nao App da Web.

URL correta deve ter formato:

```text
https://script.google.com/a/macros/uel.br/s/<deployment-id>/exec
```

Preferencia do usuario:

- Nao executar `clasp.cmd push` automaticamente. O usuario fara o push manualmente quando quiser publicar as alteracoes.

---

## Proximo Passo Recomendado

Implementar aprovacao de usuarios direto pelo painel:

- listar usuarios com `ativo = FALSE`;
- botao aprovar;
- selecao/ajuste de perfil;
- gravar `ativo = TRUE`;
- registrar log da aprovacao.

---

# Ponto de Parada - 2026-05-29

## Git

Estado deixado para continuar depois:

```text
Branch atual: dev-2026-05-30
Branch remota: origin/dev-2026-05-30
Ultimo commit entregue na main: 594a2f7 gps on
main enviada para GitHub: sim
```

Fluxo feito no fim do dia:

1. Commit `gps on` criado na branch `dev-2026-05-28-seguranca`.
2. Branch `main` recebeu esse commit por fast-forward.
3. `main` foi enviada para `origin/main`.
4. Nova branch `dev-2026-05-30` foi criada e enviada para `origin/dev-2026-05-30`.

## APK - Fluxo de Servico

Tela de detalhe do chamado ficou alinhada com o fluxo pedido:

```text
Nova Vistoria
Concluir Reparo
Foto Final
Encerrar Servico
```

Regras atuais:

- `Nova Vistoria` abre primeiro um pop-up de justificativa.
- Depois da justificativa, a nova vistoria mostra apenas `Materiais necessarios` e `Ferramentas ou equipe necessaria`.
- A justificativa entra como observacao da nova vistoria.
- Nova vistoria nao bloqueia `Concluir Reparo`.
- `Concluir Reparo` abre o pop-up com `Servico executado` e `Observacao final`.
- `Foto Final` so funciona depois de concluir o reparo.
- `Encerrar Servico` so funciona depois de concluir o reparo e tirar foto final.
- A foto final fica pendente no aparelho e so sincroniza junto com o encerramento.

Importante:

- Nao voltar a colocar `Execucao do reparo`, `Servico executado` ou `Observacao final` na tela principal.
- Esses campos pertencem somente ao pop-up do botao `Concluir Reparo`.

## APK - Offline, Login, Sair e GPS

Implementado:

- login salva sessao para nao exigir usuario/senha sempre;
- botao `Sair` limpa a sessao salva;
- app continua usando fila SQLite para trabalhar offline;
- GPS foi adicionado ao payload das acoes mobile;
- Android recebeu permissao de localizacao;
- dependencia `geolocator` adicionada ao Flutter.

Servico criado:

```text
app/lib/services/location_service.dart
```

## Google Sheets - GPS

Aba prevista/criada pelo schema:

```text
gps_chamado
```

Colunas:

```text
id
chamado_id
usuario_id
acao
origem
gps_disponivel
latitude
longitude
precisao_metros
gps_capturado_em
gps_motivo
created_at
```

Funcao manual adicionada no GAS:

```javascript
criarAbaGpsChamadoUmaVez()
```

Arquivo:

```text
gas/src/installer.gs
```

## Design do APK

Foi feita uma geral visual usando diretrizes de UI/UX:

- tema global em `app/lib/main.dart`;
- login redesenhado;
- lista de chamados com cards melhores;
- detalhe do chamado com cards, chips e mensagens melhores;
- botoes maiores e mais adequados para toque;
- mantido o fluxo de servico sem adicionar textos indesejados.

Validacao feita:

```text
flutter analyze -> sem erros
```

Observacao:

```text
dart format travou no ambiente e nao foi insistido.
```

## Fotos no Drive - Pendencia para Amanha

Pendencia aberta:

O usuario informou que a URL configurada anteriormente para a pasta raiz do Drive retorna 404:

```text
https://drive.google.com/drive/folders/197iqHWkSoFRKYKrckPhhTfLvuctBhMg_
```

O usuario apontou uma pasta que provavelmente deve ser usada:

```text
https://drive.google.com/drive/folders/1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm
```

Nao foi concluida a troca porque o usuario pediu para deixar para amanha.

Arquivo onde trocar se confirmado:

```text
gas/src/config.gs
```

Campo:

```javascript
DRIVE_ROOT_FOLDER_ID
```

Caminho atual no codigo para fotos:

```text
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero_chamado>/vistoria
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero_chamado>/conclusao
```

Na planilha fica apenas o registro/link na aba:

```text
fotos_chamado
```

## Preferencias Operacionais do Usuario

- Antes de mexer em fluxo de tela, dizer claramente o que foi entendido.
- Nao colocar campos ou textos extras na tela principal do servico.
- Nao executar `clasp.cmd push` automaticamente sem pedido explicito.
- Quando o usuario disser para publicar ou empurrar, pode executar o comando pedido.
