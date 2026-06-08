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

## Estrutura esperada

```yaml

toolbox:
  ferramentas:
    - nome: ler_manifesto_de_dependencias
      descricao: Localiza e lê o(s) manifesto(s) de dependências do projeto (ex. package.json, pom.xml, requirements.txt) e retorna a lista de pacotes declarados
      parametros:
        - caminho_do_projeto: string
      retorno: Lista de pacotes/dependências encontrados, com nome e versão

    - nome: classificar_area_por_pacotes
      descricao: Recebe a lista de pacotes do projeto e classifica a(s) área(s) de atuação predominante(s) (ex. frontend, backend, mobile, dados, infraestrutura)
      parametros:
        - pacotes: string[]
      retorno: Uma ou mais áreas de atuação, com a justificativa baseada nos pacotes que sustentam cada classificação

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
      descricao: Recebe um desenvolvedor e a lista de commits do período, e retorna os arquivos/pacotes que esse desenvolvedor alterou (usado para associá-lo à(s) área(s) de atuação)
      parametros:
        - autor: string
        - commits: object[]
      retorno: Lista de arquivos/pacotes alterados pelo autor no período analisado

  regras:
    - Cada ferramenta deve ter nome único dentro do toolbox
    - Parâmetros ausentes ou inválidos devem ser rejeitados antes da chamada real
    - Todas as ferramentas operam em modo somente leitura sobre o repositório e seus arquivos

```
