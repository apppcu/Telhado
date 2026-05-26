# Web Login And Dashboard Entry Design

## Objetivo

Criar a primeira experiencia web do sistema no Google Apps Script, com uma tela de entrada institucional, registro de acesso e encaminhamento ao dashboard.

O sistema deve usar o login Google institucional como base de seguranca. Nao deve armazenar senha propria na planilha.

## Escopo

Esta etapa cobre:

- pagina inicial de login via HTML Service;
- validacao de dominio institucional `@uel.br`;
- consulta do usuario na aba `usuarios`;
- registro inicial de acesso;
- estado de aguardando aprovacao;
- redirecionamento para o dashboard quando o usuario estiver ativo;
- layout visual da tela de entrada.

Esta etapa nao cobre:

- dashboard completo;
- edicao de chamados;
- aprovacao administrativa detalhada;
- recuperacao de senha, pois nao havera senha propria;
- login externo fora do Google Workspace.

## Principio De Seguranca

O login oficial e o login Google/Workspace. A aplicacao deve obter o e-mail do usuario autenticado pelo Apps Script e validar:

```text
email termina com @uel.br
```

Contas fora do dominio `@uel.br` devem ser bloqueadas antes de qualquer registro ou acesso ao dashboard.

## Fluxo Principal

```text
Usuario abre Web App
  -> GAS identifica e-mail Google logado
  -> valida dominio @uel.br
  -> consulta aba usuarios
  -> se usuario ativo: mostra Dashboard
  -> se usuario cadastrado e inativo: mostra Aguardando Aprovacao
  -> se usuario nao cadastrado: mostra Login com opcao Registrar Acesso
```

## Tela De Login

Layout aprovado:

```text
Tela dividida em duas colunas.

Esquerda:
- nome do sistema;
- subtitulo institucional;
- texto de acesso restrito a contas @uel.br;
- botao "Entrar com e-mail institucional";
- botao secundario "Registrar acesso";
- area curta de mensagens de erro/status.

Direita:
- imagem publica bonita relacionada a chuva, agua, lago ou ambiente chuvoso;
- overlay escuro discreto;
- frase institucional curta sobre manutencao preventiva e seguranca predial.
```

## Direcao Visual

O visual deve ser institucional, moderno e calmo. A interface deve parecer confiavel para gestores e equipes de manutencao.

Preferencias:

- lado esquerdo claro, com formulario limpo;
- lado direito fotografico;
- botoes bem visiveis;
- responsivo para desktop e celular;
- sem excesso de texto explicativo;
- sem depender de senha propria.

Imagem:

- usar imagem publica/remota de chuva, lago ou agua;
- se a imagem remota falhar, manter fundo colorido simples e legivel;
- evitar imagem escura demais que prejudique leitura.

## Registro De Acesso

O botao `Registrar acesso` abre uma tela ou modal com:

```text
nome
email
telefone
centro_sigla
perfil_solicitado
observacao
```

Regras:

- `email` e obrigatorio;
- `email` deve terminar com `@uel.br`;
- `nome` e obrigatorio;
- `centro_sigla` deve vir da aba `centros`;
- `perfil_solicitado` deve usar valores permitidos;
- novo usuario deve iniciar como inativo.

Registro gravado na aba `usuarios`:

```text
perfil = VISUALIZACAO
ativo = FALSE
```

O campo `observacao` deve registrar o perfil solicitado e justificativa do usuario, quando existir.

## Estados De Acesso

### Usuario Ativo

Condicao:

```text
usuarios.email = email logado
usuarios.ativo = TRUE
```

Resultado:

```text
mostrar dashboard
```

### Usuario Pendente

Condicao:

```text
usuarios.email = email logado
usuarios.ativo = FALSE
```

Resultado:

```text
mostrar tela de aguardando aprovacao
```

Mensagem sugerida:

```text
Seu cadastro foi recebido e aguarda aprovacao.
```

### Usuario Nao Cadastrado

Condicao:

```text
email @uel.br sem registro na aba usuarios
```

Resultado:

```text
mostrar login com opcao Registrar acesso
```

### Dominio Nao Permitido

Condicao:

```text
email nao termina com @uel.br
```

Resultado:

```text
bloquear acesso e negar registro
```

Mensagem sugerida:

```text
Acesso restrito a contas institucionais @uel.br.
```

## Backend GAS

Funcoes previstas:

```text
doGet()
getSessionContext()
registrarAcesso(payload)
getCentrosAtivos()
```

### getSessionContext()

Responsavel por:

- obter e-mail do usuario logado;
- validar dominio;
- buscar usuario na aba `usuarios`;
- retornar estado de acesso.

Retorno esperado:

```json
{
  "success": true,
  "data": {
    "email": "usuario@uel.br",
    "domainAllowed": true,
    "accessState": "ACTIVE",
    "user": {}
  },
  "error": null
}
```

Valores de `accessState`:

```text
ACTIVE
PENDING
NOT_REGISTERED
DOMAIN_DENIED
UNKNOWN_EMAIL
```

### registrarAcesso(payload)

Responsavel por:

- validar campos obrigatorios;
- rejeitar email fora de `@uel.br`;
- evitar duplicidade por email;
- inserir novo registro em `usuarios`;
- retornar estado `PENDING`.

## Dados

A etapa depende das abas criadas pelo instalador Workspace:

```text
usuarios
centros
sync_logs
```

O registro deve usar a coluna `email` como chave funcional para evitar duplicidade.

## Tratamento De Erros

Erros esperados:

- Apps Script nao consegue identificar e-mail;
- dominio nao permitido;
- usuario duplicado;
- centro invalido;
- permissao insuficiente na planilha;
- falha de escrita na aba `usuarios`.

Formato de erro:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ACCESS_ERROR",
    "message": "Descricao objetiva do erro"
  }
}
```

## Criterios De Aceite

- A tela de login abre pelo Web App.
- A tela tem coluna de login a esquerda e imagem de chuva/agua a direita.
- O sistema bloqueia e-mails fora de `@uel.br`.
- O botao `Registrar acesso` permite solicitar cadastro.
- Registro novo entra em `usuarios` com `perfil = VISUALIZACAO` e `ativo = FALSE`.
- Usuario ativo e redirecionado ao dashboard.
- Usuario inativo ve mensagem de aguardando aprovacao.
- O sistema nao armazena senha propria.

## Proximo Passo

Depois da revisao e aprovacao desta spec, criar o plano de implementacao para:

- arquivos HTML do login;
- funcoes GAS de sessao e registro;
- leitura de usuarios e centros;
- estado inicial do dashboard.
