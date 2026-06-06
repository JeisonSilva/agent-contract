# Executor — Task Execution Rules

## Overview

O Executor é responsável por **orquestrar a execução de tarefas** do agente — recebe um plano do `planner`, aciona as ferramentas do `toolbox` e gerencia o ciclo de vida de cada step.

## Execution Model

```yaml
executor:
  mode: sequential         # sequential | parallel | dag
  max_retries: 3
  retry_backoff: exponential  # 2s → 4s → 8s
  timeout_per_step: 30s
  timeout_total: 300s
  on_failure: stop_and_report  # stop_and_report | continue | rollback
```

## Task Lifecycle

```
PENDING → RUNNING → SUCCESS
                  ↘ FAILED → RETRY → SUCCESS
                                   ↘ EXHAUSTED → ABORTED
```

### State Definitions

| Estado      | Descrição                                                  |
|-------------|-------------------------------------------------------------|
| `PENDING`   | Tarefa enfileirada, aguardando recursos                    |
| `RUNNING`   | Execução ativa; pelo menos um step em andamento            |
| `SUCCESS`   | Todos os steps concluídos com resultado esperado           |
| `FAILED`    | Um step falhou; avaliando política de retry                |
| `RETRY`     | Aguardando backoff para nova tentativa                     |
| `EXHAUSTED` | Máximo de retries atingido                                 |
| `ABORTED`   | Execução encerrada manualmente ou por timeout total        |

## Step Execution Contract

Cada step de um plano deve obedecer:

```yaml
step:
  id: string             # identificador único no plano
  tool: string           # nome da ferramenta em toolbox.md
  inputs: dict           # parâmetros validados antes da chamada
  outputs: dict          # resultado esperado (schema)
  depends_on: list[id]   # dependências de outros steps
  on_error: string       # override da política global (opcional)
  timeout: duration      # override do timeout global (opcional)
```

## Retry Policy

```yaml
retry:
  max_attempts: 3
  backoff:
    strategy: exponential
    base_delay: 2s
    max_delay: 30s
  retryable_errors:
    - TIMEOUT
    - RATE_LIMIT
    - NETWORK_ERROR
  non_retryable_errors:
    - PERMISSION_DENIED
    - INVALID_INPUT
    - NOT_FOUND
```

## Observability

O Executor emite eventos para os seguintes hooks a cada mudança de estado:

- `on_tool_call` — antes de cada invocação de ferramenta
- `on_tool_result` — após cada retorno de ferramenta
- `on_error` — ao detectar falha em qualquer step

## Execution Report

Ao término, o Executor produz um relatório estruturado:

```json
{
  "task_id": "task-007",
  "cycle_id": "cycle-042",
  "status": "SUCCESS",
  "steps_total": 4,
  "steps_succeeded": 4,
  "steps_failed": 0,
  "duration_ms": 1840,
  "tools_called": ["fetch_metrics", "detect_anomaly", "notify_oncall"]
}
```
