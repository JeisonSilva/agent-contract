# Contrato: Loop

Define **o ciclo de orquestração** que une planner, executor, toolbox e hooks
em uma execução completa, do recebimento do pedido do usuário até a resposta final.

## Como o runner deve usar este arquivo

1. Disparar os hooks do grupo `inicio` (ver [hooks](../hooks.md)), uma única vez.
2. Acionar o [planner](./planner.md) para gerar o plano.
3. Para cada etapa do plano, acionar o [executor](./executor.md) (que por sua vez
   usa o [toolbox](./toolbox.md)).
4. Repetir até que todas as etapas estejam concluídas, o `limite_de_iteracoes`
   seja atingido, ou uma das `condicoes_de_parada` seja satisfeita.
5. Disparar os hooks do grupo `fim` (ver [hooks](../hooks.md)), uma única vez —
   independentemente de o ciclo ter terminado por sucesso, limite de iterações
   ou interrupção — e então devolver a resposta final ao usuário.

## Estrutura esperada

```yaml

loop:
  ciclo:
    - inicio
    - planejar
    - executar_proxima_etapa
    - validar_resultado
    - repetir_ou_finalizar

  condicoes_de_parada:
    - Todas as etapas do plano foram concluídas com sucesso
    - O limite_de_iteracoes foi atingido
    - O usuário pediu para interromper a execução

  limite_de_iteracoes: 10

  em_limite_atingido:
    acao: Interromper a execução e informar ao usuário o que foi concluído até o momento

```
