# Planilhas

As planilhas sao a persistencia operacional atual do sistema. O schema oficial
deve acompanhar `WORKSPACE_SCHEMA` em `gas/src/installer.gs`.

## Abas

```text
centros
predios
usuarios
tecnicos
chamados
historico_chamado
fotos_chamado
gps_chamado
eventos_chuva
validacoes_pos_chuva
configuracoes
sync_logs
```

## chamados

```text
id
numero
predio_id
centro_sigla
solicitante_id
descricao
categoria
prioridade
status
executante_id
data_abertura
data_fechamento
observacao
created_at
updated_at
```

## historico_chamado

```text
id
chamado_id
usuario_id
acao
origem
status_anterior
status_novo
observacao
created_at
```

## fotos_chamado

```text
id
chamado_id
drive_file_id
drive_url
tipo
observacao
created_at
```

## gps_chamado

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

## sync_logs

```text
id
origem
acao
status
referencia_tipo
referencia_id
mensagem
payload_resumo
created_at
```
