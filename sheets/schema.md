# Schema das Planilhas

Referencia operacional das abas usadas pelo Google Apps Script. A fonte
executavel do schema e `WORKSPACE_SCHEMA` em `gas/src/installer.gs`.

## centros

```text
id
sigla
nome
codigo_siga
ativo
observacao
created_at
updated_at
```

## predios

```text
id
centro_id
centro_sigla
nome
tipo
area_coberta_m2
tipo_cobertura
observacao
ativo
created_at
updated_at
```

## usuarios

```text
id
nome
email
perfil
centro_sigla
telefone
ativo
created_at
updated_at
```

## tecnicos

```text
id
nome
email
telefone
especialidade
ativo
created_at
updated_at
login
senha_hash
senha_temporaria
trocar_senha
ultimo_login
token_sessao
token_expira_em
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

## eventos_chuva

```text
id
data_referencia
data_hora_inicio
data_hora_fim
janela_horas
volume_mm
origem_api
latitude
longitude
cidade
processado
created_at
```

## validacoes_pos_chuva

```text
id
chamado_id
evento_chuva_id
predio_id
status_validacao
observacao
responsavel_id
created_at
updated_at
```

## configuracoes

```text
chave
valor
descricao
updated_at
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
