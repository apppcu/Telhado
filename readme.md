# 🏛️ Sistema de Gestão de Chamados de Telhados

**Projeto:** Universidade Estadual de Londrina  
**Objetivo:** Centralizar manutenção de telhados com vazamentos, validação técnica pós-chuva e sincronização com Google Workspace  
**Status:** 🔨 Em desenvolvimento (fase 1: estrutura base)

---

## 📋 Visão Geral

Sistema institucional para gerenciamento de chamados de manutenção de telhados com foco em:

- ✅ Abertura e acompanhamento de chamados offline
- ✅ Registro técnico da execução com fotos
- ✅ Sincronização automática com Google Workspace
- ✅ Monitoramento climático pós-conclusão
- ✅ Detecção de reincidências após chuva

**Usuários:**
- Técnicos em campo (app mobile offline-first)
- Gestores (dashboard web via HTML Service)
- Administradores (configuração)

---

## 🏗️ Arquitetura

### Fluxo Geral

```
┌─────────────┐
│ Flutter App │ (offline-first no celular)
│  (mobile)   │
└──────┬──────┘
       │
       ↓ (com internet)
┌──────────────────────┐
│  Banco Local          │
│  (SQLite no device)   │
└──────┬───────────────┘
       │
       ↓ (fila de sincronização)
┌──────────────────────────────┐
│  Google Apps Script          │
│  (API intermediária)         │
└──────┬───────────────────────┘
       │
       ├─→ Google Sheets (dados)
       ├─→ Google Drive (fotos)
       ├─→ Gmail (notificações)
       ├─→ Calendar (eventos)
       └─→ Open-Meteo API (clima)
```

### Regra Arquitetônica Principal

```
⚠️ Flutter NUNCA acessa Sheets/Drive diretamente
   Flutter → Google Apps Script → Google Workspace
```

### Fluxo Offline

1. Técnico trabalha offline (sem internet)
2. Dados salvos localmente em SQLite
3. Quando houver internet → fila de sincronização ativa
4. GAS valida, processa e distribui para Sheets/Drive
5. App marca itens como sincronizados

---

## Rotina operacional do tecnico no APK

Fluxo real esperado para chamados encaminhados para manutencao:

1. O chamado e aberto pela web e encaminhado pelo administrador para um tecnico.
2. O tecnico faz login no APK e visualiza apenas os servicos atribuidos a ele.
3. O tecnico vai ate o local do chamado e inicia a vistoria.
4. Durante a vistoria, o tecnico confere o problema, tira fotos do antes, registra observacoes tecnicas e identifica materiais, ferramentas ou apoio necessario.
5. Se o problema for simples, como telha solta ou rufo deslocado, o tecnico pode executar o reparo imediatamente.
6. Se precisar voltar com material, equipe ou mais tempo, o chamado permanece em analise/aguardando execucao.
7. Quando o reparo for executado, o tecnico registra o que foi feito, tira fotos do depois e conclui o chamado.
8. A conclusao alimenta o historico do chamado, dispara os fluxos administrativos e permite o monitoramento pos-chuva.

Estados principais para o APK:

- `ENCAMINHADO`: tecnico recebeu o servico, mas ainda nao iniciou a vistoria.
- `EM_ANALISE`: tecnico esta vistoriando ou ja registrou a vistoria e levantou o que precisa.
- `EM_EXECUCAO`: reparo em andamento.
- `CONCLUIDO`: reparo finalizado pelo tecnico.

Acoes principais previstas no APK:

- `Iniciar vistoria`
- `Salvar vistoria`
- `Resolver na hora`
- `Iniciar reparo`
- `Concluir reparo`

Primeira etapa de implementacao aprovada:

1. Criar lista real "Meus servicos" no APK.
2. Criar rota no GAS para listar apenas chamados atribuidos ao tecnico autenticado pelo token.
3. Criar tela de detalhe do chamado.
4. Adicionar acao inicial `Iniciar vistoria`.

---

## 📁 Estrutura do Projeto

```
Chuva/
├── README.md                    # Este arquivo
├── prd.md                       # Product Requirements Document
├── mem.md                       # Notas de memória
│
├── docs/
│   ├── arquitetura.md           # Diagrama técnico e decisões
│   ├── api.md                   # Contrato de API (Flutter ↔ GAS)
│   └── planilhas.md             # Estrutura das sheets (TODO)
│
├── app/                         # 📱 APLICATIVO FLUTTER
│   ├── pubspec.yaml
│   ├── android/
│   ├── ios/
│   ├── web/
│   └── lib/
│       ├── main.dart
│       ├── config.dart
│       │
│       ├── models/              # Entidades de domínio
│       │   ├── chamado.dart
│       │   ├── foto.dart
│       │   ├── usuario.dart
│       │   └── predio.dart
│       │
│       ├── repositories/        # ⚠️ ÚNICO acesso a DB local
│       │   ├── chamado_repository.dart
│       │   ├── foto_repository.dart
│       │   └── sync_repository.dart
│       │
│       ├── services/            # Lógica de negócio
│       │   ├── chamado_service.dart
│       │   ├── api_service.dart      # HTTP ↔ GAS
│       │   ├── sync_service.dart     # Fila de sincronização
│       │   ├── local_db_service.dart # SQLite wrapper
│       │   ├── camera_service.dart
│       │   └── auth_service.dart
│       │
│       ├── providers/           # State management
│       │   ├── chamado_provider.dart
│       │   └── sync_provider.dart
│       │
│       ├── pages/               # UI/Screens
│       │   ├── login_page.dart
│       │   ├── chamados_page.dart
│       │   ├── chamado_detalhe_page.dart
│       │   ├── execucao_page.dart
│       │   ├── sync_page.dart
│       │   └── config_page.dart
│       │
│       ├── widgets/             # Componentes reutilizáveis
│       │   ├── chamado_card.dart
│       │   ├── status_badge.dart
│       │   └── foto_gallery.dart
│       │
│       └── utils/
│           ├── constants.dart
│           └── helpers.dart
│
├── gas/                         # ⚙️ GOOGLE APPS SCRIPT
│   ├── appsscript.json
│   └── src/
│       ├── main.gs              # Entry point
│       │
│       ├── controllers/         # Rotas HTTP
│       │   ├── chamado_controller.gs
│       │   ├── sync_controller.gs
│       │   ├── foto_controller.gs
│       │   └── config_controller.gs
│       │
│       ├── services/            # Lógica de negócio
│       │   ├── chamado_service.gs
│       │   ├── sync_service.gs
│       │   ├── clima_service.gs
│       │   ├── email_service.gs
│       │   └── notificacao_service.gs
│       │
│       ├── repositories/        # ⚠️ ÚNICO acesso a Sheets/Drive
│       │   ├── chamado_repository.gs
│       │   ├── foto_repository.gs
│       │   ├── usuario_repository.gs
│       │   └── predio_repository.gs
│       │
│       ├── config.gs            # Configurações
│       ├── utils.gs             # Funções auxiliares
│       └── validators.gs        # Validação de entrada
│
├── sheets/                      # 📊 ESTRUTURA DAS PLANILHAS
│   ├── schema.md                # Definição dos campos
│   └── seed.md                  # Dados iniciais
│
└── test/                        # (TODO) Testes
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 🗂️ Planilhas Google Sheets

| Planilha | Descrição | Status |
|----------|-----------|--------|
| `usuarios` | Perfis de usuários (técnicos, gestores, admin) | 📋 Schema apenas |
| `predios` | Prédios do campus | 📋 Schema apenas |
| `chamados` | Registro principal de chamados | 📋 Schema apenas |
| `historico_chamado` | Log de ações por chamado | 📋 Schema apenas |
| `fotos_chamado` | Referências a fotos no Drive | 📋 Schema apenas |
| `eventos_chuva` | Eventos climáticos detectados | 📋 Schema apenas |
| `validacoes_pos_chuva` | Validações técnicas após chuva | 📋 Schema apenas |
| `sync_logs` | Log de sincronizações | 📋 Schema apenas |

---

## 🔄 Fluxo de Trabalho

### 1️⃣ Abertura de Chamado

```
Técnico no campo (offline)
  ↓
Seleciona prédio + descreve problema
  ↓
Tira fotos
  ↓
Salva em banco local
  ↓ (quando houver internet)
Sync service envia para GAS
  ↓
GAS valida e escreve em Sheets
  ↓
Gestor é notificado por email
```

### 2️⃣ Execução

```
Técnico recebe chamado
  ↓
Preenche descrição técnica + materiais
  ↓
Tira fotos do resultado
  ↓
Marca como "EM_EXECUCAO"
  ↓ (com internet)
Sincroniza com GAS
  ↓
GAS atualiza Sheets + envia fotos ao Drive
```

### 3️⃣ Conclusão

```
Técnico marca como "CONCLUIDO"
  ↓
Gestor aprova/rejeita
  ↓
Sistema inicia monitoramento climático
  ↓ (trigger diário por 30 dias)
Se chuva >= 5mm:
  Verifica se há vazamentos novos
  Se sim → REINCIDÊNCIA (notifica)
```

---

## 📡 API (Flutter ↔ Google Apps Script)

### Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/chamados` | Lista chamados do técnico |
| `POST` | `/api/chamados` | Cria novo chamado |
| `GET` | `/api/chamados/:id` | Detalhes do chamado |
| `PUT` | `/api/chamados/:id` | Atualiza status/descrição |
| `POST` | `/api/sync` | Sincroniza fila pendente |
| `POST` | `/api/fotos` | Upload de foto |
| `GET` | `/api/config` | Configurações (predios, usuários) |

### Resposta Padrão

```json
{
  "status": "success",
  "data": { /* payload */ },
  "error": null,
  "timestamp": "2026-05-24T10:30:00Z"
}
```

### Erro Padrão

```json
{
  "status": "error",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email inválido"
  },
  "timestamp": "2026-05-24T10:30:00Z"
}
```

---

## 🌦️ Monitoramento Climático

**API:** Open-Meteo (gratuita, sem autenticação)  
**Endpoint:** `https://api.open-meteo.com/v1/forecast`

**Configuração:**
- Latitude: -23.3045 (Londrina)
- Longitude: -51.1696 (Londrina)
- Timezone: America/Sao_Paulo
- Variável: `precipitation_sum` (mm)
- Threshold: ≥ 5 mm

**Trigger:** Diário (Google Apps Script time-driven trigger)

---

## 🔐 Segurança

- ✅ Login com conta Google institucional
- ✅ Controle de acesso por perfil (técnico, gestor, admin)
- ✅ Auditoria de alterações (histórico_chamado)
- ✅ Fotos armazenadas no Google Drive (seguro)
- ✅ Sem dados sensíveis em banco local do celular

---

## 📋 Status Atual

| Item | Status | Próximo Passo |
|------|--------|--------------|
| PRD + Arquitetura | ✅ Documentado | Implementação |
| Schema de Sheets | 📋 Rascunho | Finalizar + validar |
| GAS (estrutura) | 🔨 Em design | Código base |
| Flutter (estrutura) | 🔨 Em design | Código base |
| Testes | ❌ Não iniciado | Adicionar TDD |
| Deploy | ❌ Não iniciado | CI/CD setup |

---

## 🚀 Próximos Passos

### Fase 1 (MVP)

- [ ] Finalizar schema das Sheets
- [ ] Implementar GAS (controllers → services → repositories)
- [ ] Implementar Flutter (models → repositories → services → UI)
- [ ] Integração offline-first (SQLite + sync queue)
- [ ] Testes unitários (80%+ coverage)

### Fase 2

- [ ] Dashboard web (HTML Service)
- [ ] QR Code para identificar prédios
- [ ] Inspeções preventivas agendadas

### Fase 3

- [ ] IA preditiva (padrões de vazamentos)
- [ ] Análise histórica avançada
- [ ] Expansão para manutenção predial geral

---

## 🎯 Padrão de Código

Seguir PADRÃO V6 ARQUITETURA:

```
Route → Controller → Service → Repository → Sheets/Drive/SQLite
```

**Regras:**
- ✅ Sem duplicação de lógica
- ✅ Repository = ÚNICO acesso a dados
- ✅ Versão em cada arquivo: `// @version:1.0.0`
- ✅ API response padrão (status, data, error, timestamp)
- ✅ Try/catch completo em todas as chamadas externas
- ✅ Sem placeholders ou pseudo-código

---

## 🛠️ Desenvolvimento

### Setup Inicial

```bash
# Clonar repositório
git clone <repo>
cd Chuva

# Flutter
cd app
flutter pub get

# GAS (usar clasp)
cd ../gas
npm install -g @google/clasp
clasp clone <SCRIPT_ID>
```

### Branches

- `main` → versão estável
- `segunda` → trabalho deste PC
- `dev` → trabalho do outro PC

### Commits

```bash
# Seguir conventional commits
git commit -m "feat: adiciona sincronização offline"
git commit -m "fix: corrige validação de email no GAS"
```

---

## 📞 Contato

**Responsável:** Fabio Dias  
**Email:** (conforme Google Workspace)  
**Discord/Slack:** (conforme time)

---

## 📜 Referências

- [PRD Completo](./prd.md)
- [Arquitetura Técnica](./docs/arquitetura.md)
- [API Reference](./docs/api.md)
- [Schema Sheets](./sheets/schema.md)

---

**Última atualização:** 2026-05-24  
**Versão:** 2.0.0
---

## Ponto de Parada Atual - 2026-05-29

### Git

```text
Branch atual para continuar: dev-2026-05-30
Ultimo commit entregue: 594a2f7 gps on
main enviada para GitHub: sim
dev-2026-05-30 enviada para GitHub: sim
```

### Entregue no APK

- Fluxo mobile offline-first para tecnico.
- Login com sessao salva e botao `Sair`.
- Lista `Meus servicos`.
- Tela de detalhe do chamado.
- Fluxo de vistoria, nova vistoria, reparo, foto final e encerramento.
- GPS integrado nas acoes do APK.
- Design geral do app revisado com tema global, cards, botoes e mensagens melhores.

### Tela de Servico

Na tela principal do servico, o bloco de acoes deve manter somente estes botoes:

```text
Nova Vistoria
Concluir Reparo
Foto Final
Encerrar Servico
```

Regras:

- `Nova Vistoria` primeiro pede justificativa em pop-up.
- Depois da justificativa, mostra apenas materiais e ferramentas/equipe.
- `Concluir Reparo` abre pop-up com `Servico executado` e `Observacao final`.
- `Foto Final` libera depois de concluir o reparo.
- `Encerrar Servico` libera depois da foto final.
- Nao mostrar `Execucao do reparo`, `Servico executado` ou `Observacao final` fixos na tela principal.

### GPS

A localizacao foi adicionada ao APK e ao GAS.

Aba prevista no Google Sheets:

```text
gps_chamado
```

Funcao manual no GAS para criar/atualizar a aba:

```javascript
criarAbaGpsChamadoUmaVez()
```

Arquivo:

```text
gas/src/installer.gs
```

### Fotos

As fotos nao ficam na planilha. A planilha guarda somente os metadados/link na aba:

```text
fotos_chamado
```

As fotos sao enviadas para o Google Drive pelo GAS.

Caminho usado pelo codigo:

```text
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero_chamado>/vistoria
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero_chamado>/conclusao
```

Pendencia para o proximo trabalho:

- Confirmar/corrigir o `DRIVE_ROOT_FOLDER_ID`.
- O ID antigo retornou 404 para o usuario.
- Pasta indicada pelo usuario para verificar:

```text
https://drive.google.com/drive/folders/1OzzU822EbjFaUnR17DDu8MdJMWp5QVhm
```

Arquivo:

```text
gas/src/config.gs
```

### Validacao

Ultima validacao executada:

```text
flutter analyze
Resultado: sem erros
```

Observacao:

```text
dart format travou no ambiente; nao insistir sem necessidade.
```

**Ultima atualizacao real:** 2026-05-29
**Versao de acompanhamento:** 2.1.0
