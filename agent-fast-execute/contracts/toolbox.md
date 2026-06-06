# Toolbox — Tool Definitions

## Overview

O Toolbox é o catálogo de **todas as ferramentas e funções** que o agente pode invocar. Nenhuma ferramenta externa deve ser chamada sem estar registrada aqui — este é o ponto único de governança de capacidades de execução.

## Tool Template

Use o template abaixo para registrar cada ferramenta:

```yaml
tool: <nome-da-ferramenta>
description: <descrição curta do que a ferramenta faz>
inputs:
  <param_1>:
    type: <string | integer | boolean | dict | list>
    required: <true | false>
    description: <descrição do parâmetro>
  <param_2>:
    type: <tipo>
    default: <valor padrão, se houver>
outputs:
  type: <nome do tipo de retorno>
  schema:
    <campo_1>: <tipo>
    <campo_2>: <tipo>
timeout: <duração>                    # ex: 10s, 30s
requires_confirmation: <true | false> # para ações destrutivas
```

## Tool Registry

### Categoria: `math`

#### `calculator`

Avalia uma expressão aritmética e retorna o resultado numérico.

```yaml
tool: calculator
description: Evaluate a safe arithmetic expression and return the numeric result.
inputs:
  expression:
    type: string
    required: true
    description: "Arithmetic expression, e.g. \"42 * 37\""
outputs:
  type: CalculatorResult
  schema:
    expression: string
    result: number
timeout: 10s
```

#### `is_prime`

Verifica se um número inteiro é primo.

```yaml
tool: is_prime
description: Check whether a given integer is a prime number.
inputs:
  n:
    type: integer
    required: true
    description: The integer to check
outputs:
  type: PrimeResult
  schema:
    n: integer
    is_prime: boolean
    factor: integer
timeout: 5s
```

## Tool Governance

| Regra                         | Detalhe                                                        |
|-------------------------------|----------------------------------------------------------------|
| Registro obrigatório          | Toda ferramenta deve estar declarada aqui antes de ser usada   |
| Schema de I/O explícito       | Inputs e outputs tipados e documentados                        |
| Timeout por ferramenta        | Cada ferramenta tem timeout próprio; padrão global = 30s       |
| Auditoria                     | Toda chamada é logada via hook `on_tool_call`                  |
| Falha controlada              | Erros retornam `ToolError` estruturado, nunca exceções brutas  |

## Error Schema

```json
{
  "error": true,
  "tool": "<nome-da-ferramenta>",
  "error_code": "<TIMEOUT | PERMISSION_DENIED | INVALID_INPUT | NOT_FOUND | RATE_LIMIT>",
  "message": "<mensagem descritiva do erro>",
  "retryable": true,
  "timestamp": "<ISO-8601>"
}
```
