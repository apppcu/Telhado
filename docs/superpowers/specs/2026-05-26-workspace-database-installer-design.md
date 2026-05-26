# Workspace Database Installer Design

## Objetivo

Preparar automaticamente a base institucional do sistema de manutencao de telhados no Google Workspace antes da construcao do dashboard web.

O Google Sheets sera o banco principal. O Google Drive sera o repositorio de arquivos, fotos, relatorios, backups e logs. O Google Apps Script sera responsavel por criar, validar e manter essa estrutura.

## Escopo

Esta primeira etapa cobre:

- criacao e validacao das abas da planilha;
- criacao dos cabecalhos padronizados;
- carga inicial de centros e predios/departamentos;
- criacao e validacao da estrutura de pastas no Drive;
- registro da execucao em log;
- possibilidade de rodar novamente sem duplicar dados.

Esta etapa nao cobre:

- dashboard web;
- formulario operacional completo;
- app Flutter;
- upload real de fotos;
- regras finais de permissao por perfil.

## Recursos Workspace

Planilha principal:

```text
1UB_oVX-V_GXjuwmgP6u9DybpaPcaEThhBMOprPpPHFQ
```

Pasta raiz do Drive:

```text
197iqHWkSoFRKYKrckPhhTfLvuctBhMg_
```

Conta corporativa do projeto:

```text
apppcu@uel.br
```

## Modelo De Dados

O modelo aprovado e o institucional normalizado. Centros e predios ficam em abas separadas. Cada departamento listado pelo usuario sera tratado como um predio/unidade de manutencao dentro de seu centro.

Relacao principal:

```text
centros.id -> predios.centro_id -> chamados.predio_id
```

## Abas

As colunas abaixo definem nome e tipo esperado. Tipos usam a convencao:

```text
TEXT
NUMBER
DATE
DATETIME
BOOLEAN
ENUM
```

### centros

```text
id | TEXT
sigla | TEXT
nome | TEXT
codigo_siga | TEXT
ativo | BOOLEAN
observacao | TEXT
created_at | DATETIME
updated_at | DATETIME
```

### predios

```text
id | TEXT
centro_id | TEXT
centro_sigla | TEXT
nome | TEXT
tipo | ENUM
area_coberta_m2 | NUMBER
tipo_cobertura | ENUM
observacao | TEXT
ativo | BOOLEAN
created_at | DATETIME
updated_at | DATETIME
```

### usuarios

```text
id | TEXT
nome | TEXT
email | TEXT
perfil | ENUM
centro_sigla | TEXT
telefone | TEXT
ativo | BOOLEAN
created_at | DATETIME
updated_at | DATETIME
```

### chamados

```text
id | TEXT
numero | TEXT
predio_id | TEXT
centro_sigla | TEXT
solicitante_id | TEXT
descricao | TEXT
categoria | ENUM
prioridade | ENUM
status | ENUM
executante_id | TEXT
data_abertura | DATETIME
data_fechamento | DATETIME
observacao | TEXT
created_at | DATETIME
updated_at | DATETIME
```

### historico_chamado

```text
id | TEXT
chamado_id | TEXT
usuario_id | TEXT
acao | TEXT
origem | ENUM
status_anterior | TEXT
status_novo | TEXT
observacao | TEXT
created_at | DATETIME
```

### fotos_chamado

```text
id | TEXT
chamado_id | TEXT
drive_file_id | TEXT
drive_url | TEXT
tipo | ENUM
observacao | TEXT
created_at | DATETIME
```

### eventos_chuva

```text
id | TEXT
data_referencia | DATE
data_hora_inicio | DATETIME
data_hora_fim | DATETIME
janela_horas | NUMBER
volume_mm | NUMBER
origem_api | ENUM
latitude | NUMBER
longitude | NUMBER
cidade | TEXT
processado | BOOLEAN
created_at | DATETIME
```

### validacoes_pos_chuva

```text
id | TEXT
chamado_id | TEXT
evento_chuva_id | TEXT
predio_id | TEXT
status_validacao | ENUM
observacao | TEXT
responsavel_id | TEXT
created_at | DATETIME
updated_at | DATETIME
```

### configuracoes

```text
chave | TEXT
valor | TEXT
descricao | TEXT
updated_at | DATETIME
```

### sync_logs

```text
id | TEXT
origem | TEXT
acao | TEXT
status | ENUM
referencia_tipo | TEXT
referencia_id | TEXT
mensagem | TEXT
payload_resumo | TEXT
created_at | DATETIME
```

## Dicionarios E Valores Permitidos

### predios.tipo

```text
CAMPUS
PREDIO
DEPARTAMENTO
SETOR
LABORATORIO
ANEXO
OUTRO
```

Na carga inicial, todos os registros importados da lista institucional devem usar `DEPARTAMENTO`.

### predios.tipo_cobertura

```text
TELHA_FIBROCIMENTO
TELHA_METALICA
TELHA_CERAMICA
LAJE
MISTA
DESCONHECIDA
OUTRA
```

Na carga inicial, usar `DESCONHECIDA`.

### usuarios.perfil

```text
CHEFE_SETOR
MANUTENCAO
GESTOR
ADMIN
VISUALIZACAO
```

### chamados.prioridade

```text
BAIXA
MEDIA
ALTA
EMERGENCIAL
```

### chamados.status

```text
ABERTO
EM_ANALISE
EM_EXECUCAO
CONCLUIDO
CANCELADO
VALIDACAO_POS_CHUVA
REINCIDENCIA
```

### chamados.categoria

```text
INFILTRACAO_TELHADO
GOTEIRA_JANELA
ALAGAMENTO_SALA
UMIDADE_PAREDE
CALHA_ENTUPIDA
RALO_ENTUPIDO
OUTRO
```

### historico_chamado.origem

```text
MANUAL
API
SCRIPT_AUTOMATICO
IMPORTACAO
```

### fotos_chamado.tipo

```text
ABERTURA
EXECUCAO
CONCLUSAO
VALIDACAO_POS_CHUVA
OUTROS
```

### eventos_chuva.origem_api

```text
OPEN_METEO
MANUAL
```

### validacoes_pos_chuva.status_validacao

```text
PENDENTE
EVENTO_CONFIRMADO
EVENTO_NAO_CONFIRMADO
IMPACTO_DESCONHECIDO
REINCIDENCIA_CONFIRMADA
REINCIDENCIA_NAO_CONFIRMADA
```

### sync_logs.status

```text
SUCESSO
ERRO
AVISO
```

## Padroes De Identificacao

IDs institucionais devem ser estaveis, deterministicos, em ASCII, caixa alta e com hifen.

Exemplos:

```text
CENTRO-CCA
PRED-CCA-ZOOTECNIA
```

O numero do chamado deve ser sequencial, estavel e usado tambem como nome da pasta do chamado no Drive:

```text
CH-000001
CH-000002
CH-000003
```

Configuracoes iniciais relacionadas:

```text
padrao_numero_chamado_prefixo | CH-
padrao_numero_chamado_digits | 6
```

## Seed Inicial

O instalador deve criar os centros:

```text
CENTRO-CCA | CCA | Centro de Ciencias Agrarias
CENTRO-CCB | CCB | Centro de Ciencias Biologicas
CENTRO-CCE | CCE | Centro de Ciencias Exatas
CENTRO-CCS | CCS | Centro de Ciencias da Saude
CENTRO-CECA | CECA | Centro de Educacao, Comunicacao e Artes
CENTRO-CEFE | CEFE | Centro de Educacao Fisica e Esportes
CENTRO-CESA | CESA | Centro de Estudos Sociais Aplicados
CENTRO-CLCH | CLCH | Centro de Letras e Ciencias Humanas
CENTRO-CTU | CTU | Centro de Tecnologia e Urbanismo
```

O instalador deve criar os predios/departamentos informados pelo usuario vinculados aos centros correspondentes. O campo `tipo` deve iniciar como `DEPARTAMENTO`.
Campos tecnicos opcionais como `area_coberta_m2` e `tipo_cobertura` devem iniciar vazios ou com valor padrao seguro, sem bloquear a carga inicial.

Catalogo inicial de predios/departamentos:

```text
CCA | Departamento de Agronomia
CCA | Departamento de Clinicas Veterinarias
CCA | Departamento de Ciencia e Tecnologia de Alimentos
CCA | Departamento de Zootecnia
CCB | Departamento de Anatomia
CCB | Departamento de Biologia Geral
CCB | Departamento de Biologia Animal e Vegetal
CCB | Departamento de Ciencias Fisiologicas
CCB | Departamento de Ciencias Patologicas
CCB | Departamento de Histologia
CCB | Departamento de Microbiologia
CCB | Departamento de Psicologia e Psicanalise
CCB | Departamento de Psicologia Geral e Analise do Comportamento
CCB | Departamento de Psicologia Social e Institucional
CCE | Departamento de Bioquimica e Biotecnologia
CCE | Departamento de Computacao
CCE | Departamento de Estatistica
CCE | Departamento de Fisica
CCE | Departamento de Geociencias
CCE | Departamento de Geologia e Geomatica
CCE | Departamento de Matematica
CCE | Departamento de Quimica
CCS | Departamento de Clinica Cirurgica
CCS | Departamento de Clinica Medica
CCS | Departamento de Ciencias Farmaceuticas
CCS | Departamento de Enfermagem
CCS | Departamento de Fisioterapia
CCS | Departamento de Ginecologia e Obstetricia
CCS | Departamento de Medicina Oral e Odontologia Infantil
CCS | Departamento de Odontologia Restauradora
CCS | Departamento de Odontologia (Area Basica)
CCS | Departamento de Pediatria e Cirurgia Pediatrica
CCS | Departamento de Patologia, Analises Clinicas e Toxicologicas
CCS | Departamento de Saude Coletiva
CECA | Departamento de Arte Visual
CECA | Departamento de Ciencia da Informacao
CECA | Departamento de Comunicacao
CECA | Departamento de Design
CECA | Departamento de Educacao
CECA | Departamento de Musica e Teatro
CEFE | Departamento de Ciencias do Esporte
CEFE | Departamento de Educacao Fisica
CEFE | Departamento de Estudos do Movimento Humano
CESA | Departamento de Administracao
CESA | Departamento de Ciencias Contabeis
CESA | Departamento de Ciencias Economicas
CESA | Departamento de Direito Privado
CESA | Departamento de Direito Publico
CESA | Departamento de Servico Social
CLCH | Departamento de Ciencias Sociais
CLCH | Departamento de Filosofia
CLCH | Departamento de Historia
CLCH | Departamento de Letras Estrangeiras Modernas
CLCH | Departamento de Letras Vernaculas e Classicas
CTU | Departamento de Arquitetura e Urbanismo
CTU | Departamento de Construcao Civil
CTU | Departamento de Engenharia Eletrica
CTU | Departamento de Estruturas
```

O formato dos IDs deve ser deterministico para permitir reexecucao sem duplicacao:

```text
CENTRO-CCA
PRED-CCA-ZOOTECNIA
```

Nomes com acentos podem aparecer no campo `nome`. IDs devem usar ASCII, caixa alta e hifen.

A aba `configuracoes` deve iniciar com:

```text
chuva_mm_minima_relevante | 5
pasta_drive_raiz_id | 197iqHWkSoFRKYKrckPhhTfLvuctBhMg_
padrao_numero_chamado_prefixo | CH-
padrao_numero_chamado_digits | 6
open_meteo_latitude | -23.3045
open_meteo_longitude | -51.1696
open_meteo_cidade | Londrina
open_meteo_timezone | America/Sao_Paulo
```

## Estrutura Do Drive

Na pasta raiz informada, o instalador deve validar/criar:

```text
Sistema_Telhados/
  Chamados/
  Relatorios/
  Backup/
  Logs/
```

Pastas especificas por chamado serao criadas depois, quando houver chamados reais:

```text
Chamados/
  CH-000001/
    abertura/
    execucao/
    conclusao/
    validacao_pos_chuva/
```

Os nomes das subpastas de fase devem permanecer exatamente em minusculas:

```text
abertura
execucao
conclusao
validacao_pos_chuva
```

Esses nomes devem casar com `fotos_chamado.tipo` por regra de negocio, mas o nome fisico da pasta continua em minusculas para evitar variacao visual no Drive.

## Comportamento Do Instalador

Funcao principal prevista:

```text
instalarBancoWorkspace()
```

Responsabilidades:

- abrir a planilha por ID;
- criar abas ausentes;
- validar cabecalhos;
- aplicar cabecalhos quando a aba estiver vazia;
- congelar a primeira linha;
- aplicar filtro na primeira linha;
- inserir centros ausentes;
- inserir predios ausentes;
- criar pastas ausentes no Drive;
- gravar configuracoes de IDs principais;
- registrar sucesso ou erro em `sync_logs`.

## Idempotencia

O instalador deve poder rodar varias vezes.

Regras:

- nao duplicar abas;
- nao duplicar centros;
- nao duplicar predios;
- nao apagar dados existentes de chamados;
- nao recriar pastas existentes;
- nao sobrescrever observacoes manuais em `predios`;
- adicionar colunas ausentes ao fim somente quando necessario.

## Tratamento De Erros

Erros esperados:

- planilha nao encontrada;
- Drive root sem permissao;
- aba protegida ou sem permissao de escrita;
- falha ao criar pasta;
- conflito de cabecalho.

Cada erro deve gerar retorno estruturado e registro em `sync_logs`.

Formato recomendado:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_SETUP_ERROR",
    "message": "Descricao objetiva do erro"
  }
}
```

## Criterios De Aceite

- Ao rodar `instalarBancoWorkspace()`, todas as abas existem.
- Todas as abas possuem os cabecalhos definidos.
- Todas as colunas seguem os tipos esperados na spec.
- Os campos de enum possuem listas de valores permitidos documentadas.
- A aba `centros` contem os 9 centros iniciais.
- A aba `predios` contem os departamentos informados como predios.
- A aba `configuracoes` contem os parametros iniciais de chuva, Drive e numeracao.
- A estrutura basica do Drive existe.
- As subpastas de chamado usam exatamente os nomes `abertura`, `execucao`, `conclusao` e `validacao_pos_chuva`.
- A execucao aparece em `sync_logs`.
- Rodar a funcao duas vezes nao duplica registros.
- O resultado pode ser usado pelo dashboard web sem ajustes manuais.

## Proximo Passo

Depois que esta spec for revisada e aprovada, o proximo passo e criar um plano de implementacao para o instalador GAS, separando responsabilidades entre configuracao, schemas, seed, Sheets repository, Drive repository e funcao principal de instalacao.
