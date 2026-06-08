# Contrato: Planner

Define **como o agente planeja** a resolução de uma tarefa, quebrando o
objetivo do usuário em uma sequência ordenada de etapas antes de qualquer
execução.

## Como o runner deve usar este arquivo

1. Receber o objetivo/pedido do usuário.
2. Gerar um plano como lista ordenada de etapas, seguindo `estrutura_da_etapa`.
3. Entregar o plano ao [executor](./executor.md), uma etapa por vez.
4. Se o executor reportar falha, replanejar apenas a partir da etapa que falhou
   (sem recomeçar o plano inteiro), respeitando `limite_de_replanejamento`.

## Estrutura esperada

```yaml

planner:
  entrada:
    - objetivo: Pedido ou meta descrita pelo usuário em linguagem natural

  estrutura_da_etapa:
    - descricao: O que deve ser feito nessa etapa
    - acao: Verbo/operação que o executor deve realizar
    - criterio_de_sucesso: Como saber que a etapa foi concluída corretamente
    - depende_de: Lista de etapas anteriores que precisam estar concluídas

  regras:
    - Quebrar o objetivo no menor número de etapas necessárias para alcançá-lo
    - Cada etapa deve ser executável por uma única ferramenta do toolbox
    - Não detalhar a etapa além do necessário para a execução começar

  limite_de_replanejamento: 2

  saida:
    - plano: Lista ordenada de etapas no formato de estrutura_da_etapa

```
