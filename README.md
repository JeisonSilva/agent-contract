# agent-contract
Agent Cognitive

## Onde atuar

- `agents/` — contratos do agente em linguagem natural/YAML (objetivo,
  regras, skills, hooks, toolbox). Descrevem **o quê** o agente faz.
- `src/agente/` — implementação real das ferramentas e hooks declarados em
  `agents/`, e a montagem do relatório final. **É aqui que um programador de
  agents deve atuar** para construir ou ajustar este agente (veja o README
  da pasta).
- `src/runner/` — motor de execução genérico que organiza o fluxo
  (planejar → executar → validar → finalizar) lendo os contratos e
  injetando as implementações de `src/agente/`. Não precisa ser alterado
  para construir um agente (veja o README da pasta).
