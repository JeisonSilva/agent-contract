# `src/agente/` — implemente o seu agente aqui

Esta pasta concentra **tudo que é específico do agente** descrito em
`agents/` (o "catalogador-projetos-agent"): a tradução das declarações em
linguagem natural/YAML dos contratos para código real.

Se você está construindo ou ajustando este agente, é **aqui** que você
deve atuar:

- `ferramentas.ts` — implementação real de cada ferramenta declarada no
  toolbox (`agents/contracts/toolbox.md`). Ao adicionar uma ferramenta nova
  ao contrato, implemente-a em `criarFerramentas` neste arquivo.
- `hooks.ts` — implementação real de cada hook declarado em `agents/hooks.md`
  (`criarImplementacoesDeHooks`) e a montagem do relatório final entregue ao
  usuário (`montarRelatorioFinal`/`montarSinteseDoCatalogo`) — formato e
  conteúdo do relatório são decisão do agente, não do motor.

Essas implementações são **injetadas** no motor de execução
(`src/runner/`, ver `processoCognitivo.ts`) — o motor não conhece o
propósito deste agente, só sabe chamar o que foi declarado nos contratos
e injetado aqui.

## Ao criar um novo agente

1. Escreva os contratos em `agents/` (objetivo, regras, skills, hooks,
   toolbox) — eles descrevem **o quê**.
2. Implemente aqui, em `src/agente/`, **como** cada ferramenta e cada hook
   declarados nesses contratos realmente funcionam.
3. Não é necessário alterar nada em `src/runner/` — o motor lê os
   contratos e executa o que você implementou aqui.
