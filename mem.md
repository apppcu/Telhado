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
