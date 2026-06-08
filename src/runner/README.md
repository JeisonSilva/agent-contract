# `src/runner/` — motor de execução (não mexa aqui para construir um agente)

Esta pasta é o **motor genérico** que organiza o fluxo cognitivo descrito
nos contratos de `agents/contracts/`: planejar, executar, validar e repetir
ou finalizar — sempre lendo os contratos em tempo de execução, nunca
codificando o propósito de um agente específico.

- `processoCognitivo.ts` — carrega os contratos (`.md`/YAML) de `agents/` e
  monta o ciclo, injetando as implementações do agente (vindas de
  `src/agente/`) nos pontos certos.
- `loop.ts` — constrói e executa o grafo de etapas declarado em
  `loop.ciclo` (`agents/contracts/loop.md`); genérico — as etapas vêm do
  contrato, os handlers são injetados.
- `planner.ts` — gera o plano a partir do contrato `agents/contracts/planner.md`
  e das ferramentas disponíveis, perguntando ao modelo.
- `executor.ts` — escolhe e roda a ferramenta declarada no toolbox para cada
  etapa do plano, validando contra o catálogo antes de executar.
- `cicloHandlers.ts` — liga cada etapa de `loop.ciclo` ao componente certo
  (planner, executor, hooks); só conhece o **formato** dos contratos, nunca
  o conteúdo específico de um agente.

## Por que não mexer aqui

Estes arquivos não sabem (nem devem saber) o que o agente faz — "catalogar
projetos", neste caso, é um detalhe injetado de fora. Mudar o
comportamento do agente, suas ferramentas, hooks ou relatórios é trabalho
de `src/agente/`. Mudanças aqui só são necessárias se você está alterando
**a forma como qualquer agente é orquestrado** (ex: o formato dos
contratos, o mecanismo do grafo, a política de replanejamento).
