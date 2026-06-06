# Skills — Agent Capabilities

## Overview

Skills são **habilidades especializadas** que o agente domina — capacidades compostas que combinam ferramentas, memória e raciocínio para entregar valor em um domínio específico.

## Skill Template

Use o template abaixo para registrar cada skill do agente:

```yaml
skill: <nome-da-skill>
description: <descrição curta do que a skill entrega>
inputs:
  - <param_1>: <tipo>     # descreva o parâmetro
  - <param_2>: <tipo>
outputs:
  - <output_1>: <tipo>    # descreva o retorno esperado
tools_required:
  - <tool_1>              # devem existir em contracts/toolbox.md
  - <tool_2>
reasoning_pattern: <react | chain_of_thought | map_reduce | tree_of_thought>
```

## Registered Skills

> Substitua os exemplos abaixo pelas skills reais do seu agente.

### Skill 1: `<nome>`

```yaml
skill: <nome>
description: <descrição>
inputs:
  - input_1: string
  - input_2: string
outputs:
  - result: string
tools_required:
  - <tool>
reasoning_pattern: chain_of_thought
```

### Skill 2: `<nome>`

```yaml
skill: <nome>
description: <descrição>
inputs:
  - input_1: string
outputs:
  - result: string
tools_required:
  - <tool>
reasoning_pattern: react
```

## Skill Composition

Skills podem ser compostas pelo `planner` para resolver tarefas complexas:

```
<skill_principal>
    └── <sub_skill_1>   (descrição do papel)
    └── <sub_skill_2>   (descrição do papel)
```

## Adding New Skills

1. Definir inputs/outputs com tipos explícitos.
2. Listar todas as `tools_required` (devem existir em `contracts/toolbox.md`).
3. Especificar o `reasoning_pattern` adequado.
4. Adicionar casos de teste em `contracts/executor.md`.

## Reasoning Pattern Reference

| Pattern             | Quando usar                                             |
|---------------------|---------------------------------------------------------|
| `react`             | Investigação iterativa com feedback de ferramentas      |
| `chain_of_thought`  | Análise estruturada com plano definível antecipadamente |
| `map_reduce`        | Cobertura ampla / múltiplas fontes em paralelo          |
| `tree_of_thought`   | Múltiplas hipóteses que precisam ser avaliadas          |
