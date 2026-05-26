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

### centros

```text
id
sigla
nome
ativo
observacao
created_at
updated_at
```

### predios

```text
id
centro_id
centro_sigla
nome
tipo
observacao
ativo
created_at
updated_at
```

### usuarios

```text
id
nome
email
perfil
centro_sigla
ativo
created_at
updated_at
```

### chamados

```text
id
numero
predio_id
centro_sigla
solicitante_id
descricao
prioridade
status
executante_id
data_abertura
data_fechamento
observacao
created_at
updated_at
```

### historico_chamado

```text
id
chamado_id
usuario_id
acao
status_anterior
status_novo
observacao
created_at
```

### fotos_chamado

```text
id
chamado_id
drive_file_id
drive_url
tipo
observacao
created_at
```

### eventos_chuva

```text
id
data_evento
volume_mm
origem_api
processado
created_at
```

### validacoes_pos_chuva

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

### configuracoes

```text
chave
valor
descricao
updated_at
```

### sync_logs

```text
id
origem
acao
status
mensagem
payload_resumo
created_at
```

## Seed Inicial

O instalador deve criar os centros:

```text
CCA | Centro de Ciencias Agrarias
CCB | Centro de Ciencias Biologicas
CCE | Centro de Ciencias Exatas
CCS | Centro de Ciencias da Saude
CECA | Centro de Educacao, Comunicacao e Artes
CEFE | Centro de Educacao Fisica e Esportes
CESA | Centro de Estudos Sociais Aplicados
CLCH | Centro de Letras e Ciencias Humanas
CTU | Centro de Tecnologia e Urbanismo
```

O instalador deve criar os predios/departamentos informados pelo usuario vinculados aos centros correspondentes. O campo `tipo` deve iniciar como `DEPARTAMENTO`.

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
- A aba `centros` contem os 9 centros iniciais.
- A aba `predios` contem os departamentos informados como predios.
- A estrutura basica do Drive existe.
- A execucao aparece em `sync_logs`.
- Rodar a funcao duas vezes nao duplica registros.
- O resultado pode ser usado pelo dashboard web sem ajustes manuais.

## Proximo Passo

Depois que esta spec for revisada e aprovada, o proximo passo e criar um plano de implementacao para o instalador GAS, separando responsabilidades entre configuracao, schemas, seed, Sheets repository, Drive repository e funcao principal de instalacao.
