# Skills

Este arquivo descreve as **habilidades** (skills) que o agente pode acionar.
Uma skill é uma capacidade nomeada, com uma descrição do que ela faz e em
qual situação (gatilho) o agente deve considerá-la antes de improvisar.

## Como o runner deve usar este arquivo

1. Ler o bloco YAML abaixo e carregar a lista de skills na inicialização do agente.
2. Expor `nome`, `descricao` e `gatilho` de cada skill ao modelo (ex: como parte
   do prompt de sistema ou como entradas para roteamento de intenção).
3. Quando o contexto da tarefa casar com o `gatilho` de uma skill, priorizar o
   uso dela em vez de uma resposta genérica.

## Estrutura esperada

Cada skill deve conter:
- `nome`: identificador curto da skill
- `descricao`: o que a skill faz e quando ela é útil
- `gatilho`: condição/contexto que indica que essa skill deve ser usada

```yaml

skills:
  - nome: analisar-pacotes-do-projeto
    descricao: Lê o manifesto de dependências do projeto (ex. package.json, pom.xml, requirements.txt) e classifica o projeto por área de atuação (frontend, backend, mobile, dados, infraestrutura, etc.)
    gatilho: Início da catalogação de um projeto, antes de qualquer outra análise

  - nome: mapear-desenvolvedores-por-commits
    descricao: Lê o histórico de commits dos últimos 3 meses do projeto e identifica quem são os desenvolvedores ativos
    gatilho: A área de atuação do projeto já foi definida pela skill analisar-pacotes-do-projeto

  - nome: associar-desenvolvedores-as-areas
    descricao: Cruza os desenvolvedores identificados com a(s) área(s) de atuação do projeto, com base nos arquivos/pacotes que cada um alterou nos commits analisados
    gatilho: A área de atuação e a lista de desenvolvedores ativos já foram definidas pelas skills anteriores

```
