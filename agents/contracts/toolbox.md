# Contrato: Toolbox

Cataloga as **ferramentas** que o agente pode invocar durante a execução de
um plano. Cada ferramenta é uma capacidade concreta (função, integração,
consulta) com uma interface bem definida.

## Como o runner deve usar este arquivo

1. Carregar o catálogo de ferramentas na inicialização do agente.
2. Disponibilizar cada ferramenta ao modelo (ex: via function/tool calling) usando
   `nome`, `descricao` e `parametros`.
3. Antes de cada chamada, validar se os parâmetros recebidos do executor
   correspondem ao schema declarado em `parametros`.
4. Nunca permitir que o executor chame uma ferramenta que não esteja catalogada aqui.

## Ferramentas de API (api_config)

Qualquer ferramenta pode declarar o campo `api_config` para ser implementada
automaticamente pelo runner, sem precisar de código TypeScript adicional.

O runner detecta `api_config.url` e cria uma implementação genérica que:
- Faz a requisição HTTP com o `method` e `headers` configurados.
- Substitui `${NOME_VAR}` na url e nos headers pelo valor da variável de ambiente
  correspondente — ideal para tokens e segredos.
- Retorna o corpo da resposta como JSON (ou texto se o Content-Type não for JSON).
- Lança erro com status HTTP quando a resposta não for bem-sucedida.

**Mesma ferramenta, múltiplas APIs:** declare quantas entradas quiser no toolbox,
cada uma com `api_config` apontando para endpoints diferentes. O runner cria uma
implementação independente para cada declaração.

**Campos suportados em `api_config`:**

| Campo     | Tipo                        | Obrigatório | Descrição                               |
|-----------|-----------------------------|-------------|-----------------------------------------|
| `url`     | string                      | sim         | Endpoint completo; aceita `${VAR}`      |
| `method`  | string                      | não         | Método HTTP (padrão: GET)               |
| `headers` | map<string, string>         | não         | Cabeçalhos; valores aceitam `${VAR}`    |
| `body`    | qualquer valor JSON         | não         | Corpo para POST/PUT/PATCH               |

**Exemplo de declaração no toolbox:**

```yaml
# Tool sem autenticação
- nome: listar_repositorios_publicos
  descricao: Lista repositórios públicos de uma organização no GitHub
  api_config:
    url: https://api.github.com/orgs/minha-org/repos
    method: GET
    headers:
      Accept: application/vnd.github+json

# Tool com token via variável de ambiente
- nome: buscar_usuario_interno
  descricao: Busca dados de um colaborador na API interna de RH
  api_config:
    url: https://rh.empresa.com/api/colaboradores
    method: GET
    headers:
      Authorization: "Bearer ${RH_API_TOKEN}"
      Accept: application/json

# Tool de escrita (POST) com body estático
- nome: notificar_catalogacao
  descricao: Envia notificação de conclusão de catalogação para o webhook do time
  api_config:
    url: https://hooks.empresa.com/catalogacao
    method: POST
    headers:
      X-API-Key: "${WEBHOOK_KEY}"
    body:
      evento: catalogacao_concluida
```

## Ferramentas MCP (mcp_config)

Qualquer ferramenta pode declarar `mcp_config` para se conectar a um servidor MCP
(Model Context Protocol), sem precisar de código TypeScript adicional.

O runner detecta `mcp_config.transport` e `mcp_config.tool`, cria o cliente MCP,
executa a tool e retorna o resultado. A conexão é aberta e fechada a cada chamada.

**Transportes suportados:**

| Transport | Quando usar                                                                 |
|-----------|-----------------------------------------------------------------------------|
| `stdio`   | Servidor MCP local iniciado como processo (banco de dados, filesystem, etc) |
| `http`    | Servidor MCP remoto com protocolo Streamable HTTP (versão moderna)          |
| `sse`     | Servidor MCP remoto legado com Server-Sent Events                           |

**Campos comuns (todos os transportes):**

| Campo       | Tipo                    | Obrigatório | Descrição                                        |
|-------------|-------------------------|-------------|--------------------------------------------------|
| `transport` | `stdio` / `http` / `sse`| sim         | Tipo de conexão                                  |
| `tool`      | string                  | sim         | Nome da tool a invocar no servidor MCP           |
| `tool_args` | map<string, any>        | não         | Argumentos estáticos passados à tool MCP         |

**Campos exclusivos de `stdio`:**

| Campo     | Tipo             | Obrigatório | Descrição                                               |
|-----------|------------------|-------------|---------------------------------------------------------|
| `command` | string           | sim         | Executável a iniciar (ex: `npx`, `python`, `uvx`)       |
| `args`    | string[]         | não         | Argumentos do executável                                |
| `env`     | map<string, string> | não      | Variáveis de ambiente adicionais; aceita `${VAR}`       |

**Campos exclusivos de `http` / `sse`:**

| Campo     | Tipo                | Obrigatório | Descrição                                           |
|-----------|---------------------|-------------|-----------------------------------------------------|
| `url`     | string              | sim         | Endpoint do servidor MCP; aceita `${VAR}`           |
| `headers` | map<string, string> | não         | Cabeçalhos HTTP (token, chave de API); aceita `${VAR}` |

**Substituição de variáveis de ambiente:** qualquer valor string nos campos `url`,
`headers` e `env` aceita a sintaxe `${NOME_VAR}`, que é resolvida em tempo de
execução — tokens e segredos nunca precisam ficar no arquivo de contrato.

**Exemplos de declaração no toolbox:**

```yaml
# Banco de dados PostgreSQL via MCP stdio (sem token; auth via DATABASE_URL)
- nome: query_postgres
  descricao: Executa queries SQL no banco de dados PostgreSQL
  mcp_config:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-postgres"]
    env:
      DATABASE_URL: "${DATABASE_URL}"
    tool: query
    tool_args:
      sql: "SELECT version()"
  parametros: []
  retorno: Resultado da query SQL

# Filesystem local via MCP stdio
- nome: ler_arquivo_remoto
  descricao: Lê o conteúdo de um arquivo no servidor de arquivos
  mcp_config:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/pasta/raiz"]
    tool: read_file
    tool_args:
      path: "/pasta/raiz/README.md"
  parametros: []
  retorno: Conteúdo do arquivo

# Servidor MCP remoto com token via Streamable HTTP
- nome: buscar_contatos_crm
  descricao: Busca contatos no CRM corporativo via MCP HTTP
  mcp_config:
    transport: http
    url: https://mcp.empresa.com/crm
    headers:
      Authorization: "Bearer ${CRM_MCP_TOKEN}"
    tool: list_contacts
  parametros: []
  retorno: Lista de contatos do CRM

# Servidor MCP legado via SSE com token no header
- nome: consultar_erp
  descricao: Consulta dados financeiros no ERP corporativo via MCP SSE
  mcp_config:
    transport: sse
    url: https://erp.empresa.com/mcp
    headers:
      X-API-Key: "${ERP_API_KEY}"
    tool: get_financial_summary
  parametros: []
  retorno: Resumo financeiro do ERP
```

## Estrutura esperada

```yaml

toolbox:
  ferramentas:
    - nome: ler_manifesto_de_dependencias
      descricao: Localiza e lê o(s) manifesto(s) de dependências do projeto (ex. package.json, pom.xml, requirements.txt) e retorna a lista de pacotes declarados
      parametros:
        - caminho_do_projeto: string
      retorno: Lista de pacotes/dependências encontrados, com nome e versão

    - nome: identificar_dominio_do_projeto
      descricao: Analisa a documentação (README), descrição/palavras-chave do manifesto e a estrutura de pastas/módulos do projeto para identificar o domínio de negócio do produto e seus subdomínios (ex. domínio "Financeiro" com subdomínios "Investimentos", "Câmbio", "Pagamentos")
      parametros:
        - caminho_do_projeto: string
      retorno: Domínio de negócio do projeto e lista de subdomínios do produto, cada um com justificativa e, quando identificáveis pela estrutura de pastas, os módulos/diretórios relacionados

    - nome: listar_commits_por_periodo
      descricao: Retorna os commits do repositório dentro de uma janela de datas
      parametros:
        - caminho_do_projeto: string
        - data_inicio: string (YYYY-MM-DD)
        - data_fim: string (YYYY-MM-DD)
      retorno: Lista de commits no período, com autor, data, mensagem e arquivos alterados

    - nome: identificar_desenvolvedores_ativos
      descricao: Recebe uma lista de commits e consolida os autores únicos, considerando apenas quem tem ao menos um commit no período analisado
      parametros:
        - commits: object[]
      retorno: Lista de desenvolvedores ativos, com nome/identificação e quantidade de commits no período

    - nome: listar_arquivos_alterados_por_autor
      descricao: Recebe um desenvolvedor e a lista de commits do período, e retorna os arquivos/pacotes que esse desenvolvedor alterou (usado para associá-lo a(os) subdomínio(s) do produto)
      parametros:
        - autor: string
        - commits: object[]
      retorno: Lista de arquivos/pacotes alterados pelo autor no período analisado

    - nome: buscar_analises_similares
      descricao: Busca na memória semântica (pgvector) análises de projetos anteriores semanticamente similares ao projeto atual, usando o domínio identificado como consulta. Útil para contextualizar a análise com experiências passadas de projetos parecidos. Só disponível quando DATABASE_URL está configurada.
      parametros: []
      retorno: Lista de até 3 análises anteriores similares, com caminho do projeto, conteúdo resumido e score de similaridade

    - nome: salvar_analise_em_memoria
      descricao: Persiste os resultados completos da análise atual na memória semântica (pgvector) para consultas futuras. Deve ser invocada como última etapa do plano, após todas as ferramentas de coleta terem sido executadas. Só disponível quando DATABASE_URL está configurada.
      parametros: []
      retorno: ID único da análise salva e confirmação de persistência

  regras:
    - Cada ferramenta deve ter nome único dentro do toolbox
    - Parâmetros ausentes ou inválidos devem ser rejeitados antes da chamada real
    - Todas as ferramentas operam em modo somente leitura sobre o repositório e seus arquivos

```
