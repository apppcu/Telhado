# Contrato da API

Este documento descreve o contrato HTTP consumido pelo app Flutter e pelo dashboard.
Hoje a implementacao oficial roda em Google Apps Script, mas o contrato deve ser
tratado como independente do GAS para permitir migracao futura para outro backend.

## Objetivo

- Manter o app mobile desacoplado de Google Sheets, Google Drive e detalhes do GAS.
- Definir payloads, respostas, erros e regras de idempotencia de forma estavel.
- Servir como referencia para uma futura API propria sem reescrever o Flutter.

Regra obrigatoria: clientes nunca acessam Sheets ou Drive diretamente.

```text
Flutter / Dashboard -> API HTTP -> Sheets / Drive / Gmail / servicos externos
```

## Base URL atual

```text
https://script.google.com/macros/s/AKfycbxwO0W0O1Kd8UTVYZMgn62QZIwYVUQJPYgSB2_8b0i4jamcoYerZyPwyrMp5YfpopBQoA/exec
```

Clientes devem manter a URL configuravel. A URL acima e um detalhe de ambiente,
nao uma regra do produto.

## Formato de requisicao

As operacoes principais usam `POST` com JSON:

```json
{
  "action": "nome_da_acao",
  "payload": {
    "campo": "valor"
  }
}
```

Consultas web especificas podem aceitar `GET ?action=...`. Novas integracoes
mobile devem preferir `POST` com `action` e `payload`.

A rota legada `GET ?action=chamados` foi removida por expor dados operacionais
sem autenticacao.

## Resposta padrao

Sucesso:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Erro:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CODIGO_ESTAVEL",
    "message": "Mensagem legivel para usuario ou operador."
  }
}
```

Regras:

- `error.code` deve ser estavel para o cliente tomar decisao.
- `error.message` pode mudar para melhorar comunicacao.
- Erros de regra de negocio devem retornar HTTP 200 com `success: false`,
  mantendo compatibilidade com Apps Script.
- Erros de transporte podem retornar status HTTP diferente de 2xx.

## Autenticacao mobile

O tecnico autentica por login e senha. A API retorna um token temporario.

### `login_tecnico_mobile`

Payload:

```json
{
  "login": "tecnico",
  "senha": "senha"
}
```

Resposta esperada em `data`:

```json
{
  "token": "token-temporario",
  "token_expira_em": "2026-05-30T23:59:59.000-03:00",
  "trocar_senha": false,
  "tecnico": {
    "id": "TEC-123",
    "nome": "Nome do tecnico",
    "login": "tecnico"
  }
}
```

### `trocar_senha_tecnico_mobile`

Payload:

```json
{
  "token": "token-temporario",
  "nova_senha": "NovaSenha1"
}
```

Resposta: mesma estrutura de sessao do login, com novo token quando aplicavel.

Regras:

- O app pode salvar sessao local ate `token_expira_em`.
- Ao sincronizar pendencias antigas, o app deve substituir o token salvo pelo
  token atual da sessao.
- `Sair` no app deve remover a sessao local.
- Cinco tentativas invalidas de login tecnico bloqueiam novas tentativas por
  aproximadamente 15 minutos.
- Token sem data de expiracao valida deve ser rejeitado.

## Chamados do tecnico

### `listar_chamados_tecnico_mobile`

Payload:

```json
{
  "token": "token-temporario"
}
```

Resposta esperada em `data`:

```json
{
  "tecnico": {
    "id": "TEC-123",
    "nome": "Nome do tecnico",
    "login": "tecnico"
  },
  "chamados": [
    {
      "id": "CHAM-123",
      "numero": "2026-0001",
      "predio_id": "PRED-1",
      "predio_nome": "Predio",
      "centro_sigla": "CTU",
      "descricao": "Descricao do problema",
      "categoria": "VAZAMENTO",
      "prioridade": "NORMAL",
      "status": "ENCAMINHADO",
      "observacao": "",
      "data_abertura": "2026-05-30T10:00:00.000-03:00",
      "data_fechamento": "",
      "updated_at": "2026-05-30T10:00:00.000-03:00"
    }
  ]
}
```

Regras:

- Retornar apenas chamados atribuidos ao tecnico autenticado.
- Nao retornar chamados `CONCLUIDO` para a lista principal do app.
- O cliente tambem deve ocultar chamados concluidos que existam no cache local.

## Fluxo mobile do chamado

Status oficiais:

```text
ABERTO
ENCAMINHADO
EM_ANALISE
EM_EXECUCAO
CONCLUIDO
```

### `iniciar_vistoria_tecnico_mobile`

Payload minimo:

```json
{
  "token": "token-temporario",
  "chamado_id": "CHAM-123"
}
```

Transicao esperada:

```text
ENCAMINHADO -> EM_ANALISE
EM_ANALISE -> EM_ANALISE
```

### `salvar_vistoria_tecnico_mobile`

Payload:

```json
{
  "token": "token-temporario",
  "chamado_id": "CHAM-123",
  "observacao_tecnica": "",
  "materiais": "",
  "ferramentas": "",
  "resolver_na_hora": false
}
```

Regras:

- `observacao_tecnica`, `materiais` e `ferramentas` sao opcionais.
- A vistoria normal exige foto antes no app antes de salvar.
- A API deve aceitar textos vazios e registrar historico auditavel.
- Status esperado ao salvar: `EM_ANALISE`, exceto se `resolver_na_hora` for
  usado por compatibilidade.

### `iniciar_reparo_tecnico_mobile`

Payload:

```json
{
  "token": "token-temporario",
  "chamado_id": "CHAM-123"
}
```

Transicao esperada:

```text
EM_ANALISE -> EM_EXECUCAO
```

### `reabrir_vistoria_tecnico_mobile`

Payload:

```json
{
  "token": "token-temporario",
  "chamado_id": "CHAM-123",
  "justificativa": "Motivo da nova vistoria"
}
```

Regras:

- `justificativa` e obrigatoria.
- A acao deve retornar o chamado para `EM_ANALISE`.
- A nova vistoria nao deve bloquear a conclusao posterior do reparo.

### `concluir_reparo_tecnico_mobile`

Payload:

```json
{
  "token": "token-temporario",
  "chamado_id": "CHAM-123",
  "servico_executado": "",
  "observacao_final": ""
}
```

Regras:

- `servico_executado` e `observacao_final` sao opcionais.
- O app exige foto final antes de encerrar.
- A API deve aceitar encerramento vindo de `ENCAMINHADO`, `EM_ANALISE` ou
  `EM_EXECUCAO`, para suportar sincronizacao offline.
- Encerramento de chamado ja `CONCLUIDO` deve ser idempotente e retornar sucesso.

## Fotos

### `upload_foto`

Payload:

```json
{
  "token": "token-temporario",
  "chamado_id": "CHAM-123",
  "tipo": "VISTORIA_ANTES",
  "file_name": "foto.jpg",
  "mime_type": "image/jpeg",
  "content_base64": "..."
}
```

Tipos reconhecidos:

```text
VISTORIA_ANTES
CONCLUSAO
```

Resposta esperada em `data`:

```json
{
  "foto_id": "FOTO-123",
  "chamado_id": "CHAM-123",
  "drive_file_id": "arquivo-drive",
  "drive_url": "https://drive.google.com/...",
  "tipo": "VISTORIA_ANTES",
  "created_at": "2026-05-30T10:00:00.000-03:00"
}
```

Regras:

- A imagem fica no Drive.
- Sheets guarda apenas metadados e links.
- Somente os tipos `VISTORIA_ANTES` e `CONCLUSAO` sao aceitos.
- O upload deve ser JPEG valido com no maximo 6 MB.
- Caminho atual:

```text
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/vistoria
DRIVE_ROOT_FOLDER_ID/Sistema_Telhados/Chamados/<numero>/conclusao
```

## Localizacao GPS

Operacoes mobile podem incluir `localizacao` dentro do payload:

```json
{
  "localizacao": {
    "gps_disponivel": true,
    "latitude": -23.3045,
    "longitude": -51.1696,
    "precisao_metros": 12.5,
    "gps_capturado_em": "2026-05-30T10:00:00.000-03:00"
  }
}
```

Quando GPS nao estiver disponivel:

```json
{
  "localizacao": {
    "gps_disponivel": false,
    "gps_motivo": "PERMISSAO_NEGADA",
    "gps_capturado_em": "2026-05-30T10:00:00.000-03:00"
  }
}
```

Regras:

- Falha de GPS nao bloqueia nenhuma operacao.
- A API deve registrar a tentativa na aba `gps_chamado` quando o payload existir.
- A localizacao tambem pode entrar no historico como resumo textual.

## Sincronizacao offline

O app enfileira cada acao localmente e tenta sincronizar quando houver internet.

Regras de compatibilidade:

- As operacoes devem ser seguras para repeticao quando possivel.
- `concluir_reparo_tecnico_mobile` deve ser idempotente para `CONCLUIDO`.
- `CHAMADO_NAO_ENCONTRADO` em pendencia antiga deve ser tratado pelo app como
  pendencia descartavel para destravar a fila.
- Upload de foto depende do arquivo local existir ate a sincronizacao terminar.
- O app deve enviar o token atual, mesmo que a pendencia tenha sido criada com
  token antigo.

## Dashboard

O dashboard usa a mesma API HTTP, mas pode chamar funcoes internas do GAS na
implementacao atual.

Rotas/acoes relevantes:

```text
GET dashboard
GET historico_chamado
POST criar_chamado
POST atualizar_chamado
GET validar_pos_chuva
POST confirmar_validacao_pos_chuva
GET config
```

Regras de produto:

- Login institucional para solicitante/admin/gestor.
- Admin/gestor pode abrir, encaminhar, acompanhar e exportar relatorios.
- `Chamados recentes` abre filtrado por `Aberto`.
- Exportacoes ficam em `Relatorio`: CSV, Excel `.xls` e PDF.
- `Gerenciar chamado` encaminha direto para manutencao.
- Widget de clima usa Open-Meteo para Londrina/PR.
- Link de validacao pos-chuva abre uma confirmacao antes de alterar dados.
- Links novos de validacao pos-chuva expiram em 30 dias.

## Codigos de erro importantes

```text
TOKEN_OBRIGATORIO
SESSAO_INVALIDA
TECNICO_INATIVO
CHAMADO_ID_OBRIGATORIO
CHAMADO_NAO_ENCONTRADO
CHAMADO_NAO_ATRIBUIDO
STATUS_INVALIDO_PARA_VISTORIA
STATUS_INVALIDO_PARA_SALVAR_VISTORIA
STATUS_INVALIDO_PARA_INICIAR_REPARO
STATUS_INVALIDO_PARA_NOVA_VISTORIA
STATUS_INVALIDO_PARA_CONCLUIR_REPARO
JUSTIFICATIVA_OBRIGATORIA
TIPO_FOTO_INVALIDO
FOTO_OBRIGATORIA
FORMATO_FOTO_INVALIDO
FOTO_MUITO_GRANDE
LOGIN_TEMPORARIAMENTE_BLOQUEADO
ROTA_NAO_ENCONTRADA
```

Novos erros devem usar codigo estavel em caixa alta e mensagem em portugues.

## Requisitos para migracao futura

Para trocar GAS por API propria no futuro, manter:

- Mesmo formato `action + payload` durante a transicao.
- Mesmos codigos de erro usados pelo app.
- Mesmas regras de status e idempotencia.
- Compatibilidade com fotos em base64 ou endpoint equivalente documentado.
- Token de sessao com expiracao explicita.
- Exportacao de relatorios como responsabilidade do backend.

Quando a API propria existir, a primeira etapa recomendada e criar um adaptador
que replique este contrato antes de alterar telas do Flutter.
