# Hooks

Hooks são pontos de extensão no ciclo de vida do agente onde é possível
injetar instruções, validações ou ações automáticas sem alterar o núcleo
do agente nem os contratos de planejamento/execução.

## Como o runner deve usar este arquivo

1. Carregar a lista de hooks na inicialização do agente, já agrupados por evento.
2. Disparar o grupo `inicio` uma única vez, antes de o [planner](./contracts/planner.md)
   gerar o plano (ver [loop](./contracts/loop.md)).
3. Disparar o grupo `fim` uma única vez, ao final do [loop](./contracts/loop.md) —
   independentemente de ele ter terminado por sucesso, por limite de iterações
   atingido ou por erro — sempre na última etapa, antes de devolver a resposta ao usuário.
4. Hooks são declarativos: a `acao` é uma instrução em linguagem natural que o
   runner deve traduzir em comportamento (ex: chamar uma função, validar uma
   condição, registrar log, montar um relatório).

## Estrutura esperada

Os hooks são organizados em apenas dois grupos, um por evento do ciclo de vida:
- `inicio`: disparado uma única vez, ao começar a catalogação do projeto —
  usado para validar pré-condições antes de qualquer análise
- `fim`: disparado uma única vez, ao encerrar a catalogação (com sucesso,
  com falha ou por limite de iterações) — usado para consolidar o resultado

Cada hook dentro de um grupo deve conter:
- `nome`: identificador curto do hook
- `acao`: o que deve ser feito quando o hook for disparado

```yaml

hooks:
  inicio:
    - nome: preparar-analise-do-projeto
      acao: Confirmar o acesso de leitura ao repositório e limpar qualquer catalogação anterior em memória antes de começar

    - nome: validar-presenca-de-manifesto
      acao: Verificar se o projeto possui um manifesto de dependências reconhecível (ex. package.json, pom.xml, requirements.txt); se não houver, informar ao usuário que a classificação por área não pode ser feita e interromper

    - nome: validar-janela-de-commits
      acao: Confirmar que a leitura do histórico de commits será restrita aos últimos 3 meses antes de iniciar a análise dos desenvolvedores

  fim:
    - nome: consolidar-relatorio-de-catalogacao
      acao: Reunir a área de atuação do projeto, os desenvolvedores identificados e o mapeamento final entre desenvolvedores e áreas em um único relatório para o usuário

    - nome: registrar-log-de-execucao
      acao: Gravar no log o resultado da catalogação (sucesso, falha ou interrupção por limite) junto com o relatório consolidado ou o motivo da falha

```
