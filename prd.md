# PRD - Controle Telhado

## 1. Visao geral

O Controle Telhado centraliza chamados de vazamento e manutencao de telhados da UEL, combinando dashboard web, app tecnico offline-first e Google Workspace.

Objetivo: reduzir perda de informacao entre solicitante, gestor e tecnico, mantendo historico, fotos, status e dados climaticos em um fluxo unico.

## 2. Usuarios

| Perfil | Responsabilidade |
|---|---|
| Solicitante | Abrir chamados e acompanhar solicitacoes |
| Admin/Gestor | Triar, encaminhar, acompanhar e exportar relatorios |
| Tecnico | Executar vistoria, reparo, fotos e encerramento pelo APK |

## 3. Arquitetura de produto

```text
Dashboard Web / Flutter APK
  -> Google Apps Script
  -> Google Sheets, Drive, Gmail e Open-Meteo
```

Requisito obrigatorio: app mobile nao acessa Sheets/Drive diretamente.

## 4. Fluxo operacional

1. Chamado e aberto no dashboard web com centro/local, descricao e prioridade.
2. Status inicial: `ABERTO`.
3. Admin encaminha para tecnico de manutencao.
4. Status passa para `ENCAMINHADO`.
5. Tecnico visualiza no APK em `Meus servicos`.
6. Tecnico registra vistoria normal com foto antes, ou abre nova vistoria com justificativa.
7. Tecnico registra conclusao do reparo; textos sao opcionais.
8. Tecnico adiciona foto final.
9. Tecnico encerra o servico; status final: `CONCLUIDO`.
10. Dashboard atualiza indicadores, historico e relatorios.

## 5. Status

```text
ABERTO
ENCAMINHADO
EM_ANALISE
EM_EXECUCAO
CONCLUIDO
```

## 6. Regras mobile

- Tecnico ve apenas chamados atribuidos a ele.
- App funciona offline com SQLite e fila de sincronizacao.
- Login salva sessao local; botao `Sair` limpa sessao.
- Pendencias devem sincronizar usando token atual.
- Se pendencia antiga referenciar chamado apagado, a fila nao deve ficar travada.
- `Nova Vistoria` exige justificativa.
- Campos de texto dentro de vistoria e reparo nao sao obrigatorios.
- Foto antes e obrigatoria na vistoria normal.
- Foto final e obrigatoria antes de encerrar.
- GPS e enviado quando disponivel; falha de GPS nao bloqueia o fluxo.

## 7. Regras do dashboard

- Login institucional.
- Admin/gestor pode abrir chamado, gerenciar chamados, aprovar acessos, cadastrar tecnicos e gerar relatorios.
- `Gerenciar chamado` encaminha para manutencao e salva direto.
- Nao ha campo obrigatorio de observacao tecnica no encaminhamento.
- `Chamados recentes` abre filtrado por `Aberto`.
- Exportacao de chamados fica em `Relatorio`, com CSV, Excel e PDF.
- Widget de clima mostra chuva prevista, temperatura atual e condicao visual.

## 8. Dados principais

Aba `chamados`:

```text
id, numero, centro_sigla, predio_id, descricao, prioridade,
status, executante_id, executante_nome, data_abertura, data_fechamento
```

Aba `historico_chamado`:

```text
id, chamado_id, usuario_id, acao, status_anterior, status_novo,
observacao, created_at
```

Aba `fotos_chamado`:

```text
id, chamado_id, tipo, nome_arquivo, drive_file_id, drive_url,
origem, created_at
```

Aba `gps_chamado`:

```text
id, chamado_id, usuario_id, acao, origem, gps_disponivel,
latitude, longitude, precisao_metros, gps_capturado_em,
gps_motivo, created_at
```

## 9. Fotos e Drive

Fotos ficam no Google Drive. Sheets guarda apenas metadados e links.

Pasta raiz confirmada:

```text
1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm
```

Estrutura:

```text
Sistema_Telhados/Chamados/<numero>/vistoria
Sistema_Telhados/Chamados/<numero>/conclusao
```

## 10. Clima

Fonte: Open-Meteo.

Dashboard usa previsao de chuva de Londrina/PR, temperatura atual e codigo de tempo para mostrar sol, nuvem ou chuva.

## 11. Requisitos nao funcionais

- Historico auditavel por chamado.
- API GAS com resposta estruturada e codigo de erro preservado.
- Fluxo mobile tolerante a sessao expirada e pendencias antigas.
- Interface simples em campo, com botoes grandes e pouca friccao.
- Relatorios exportaveis para uso administrativo.

## 12. Fora do escopo atual

- IA preditiva.
- QR Code de predios.
- Aprovacao manual do gestor depois do tecnico encerrar.
- Monitoramento pos-chuva automatizado completo.
- Teste offline completo em producao.

## 13. Sucesso do MVP

- Chamado aberto no dashboard chega ao tecnico correto.
- Tecnico consegue vistoriar, fotografar, reparar e encerrar.
- Fotos aparecem no Drive correto.
- Sheets recebe status, historico, fotos e GPS.
- Dashboard mostra chamados, clima e relatorios administrativos.
