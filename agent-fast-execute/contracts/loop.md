# Loop — Continuous Execution Cycle

## Overview

O Loop define o **ciclo de execução contínuo** do agente, baseado no modelo cognitivo de três fases: **Percepção → Pensamento → Ação**. É o coração do agente autônomo.

## Cycle Model

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT LOOP                           │
│                                                         │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│   │ PERCEIVE │───▶│  THINK   │───▶│   ACT    │         │
│   └──────────┘    └──────────┘    └──────────┘         │
│        │                                  │             │
│        └──────────────◀───────────────────┘             │
│                    (next cycle)                         │
└─────────────────────────────────────────────────────────┘
```

## Loop Configuration

```yaml
loop:
  mode: continuous          # continuous | triggered | scheduled
  interval: 60s             # para mode: scheduled
  max_iterations: null      # null = sem limite; inteiro = limite fixo
  idle_behavior: wait       # wait | sleep | shutdown
  
  schedule:                 # para mode: scheduled (cron)
    expression: "*/5 * * * *"
    timezone: UTC
```

## Phase Definitions

### Phase 1: Perceive (Percepção)

Coleta de dados do ambiente externo.

```yaml
perceive:
  sources:
    - type: metrics_stream
      poll_interval: 30s
    - type: alert_queue
      mode: event_driven
    - type: log_tail
      services: ["api-gateway", "auth-service"]
  timeout: 10s
  on_empty: skip_to_next_cycle
```

**Saída:** `Observation` — representação estruturada do estado atual do ambiente.

### Phase 2: Think (Pensamento)

Raciocínio sobre as observações para decidir ações. Delega ao `planner`.

```yaml
think:
  planner: contracts/planner.md
  context_sources:
    - current_observation
    - short_term_memory
    - relevant_long_term_memories
  output: ExecutionPlan
  timeout: 15s
```

**Saída:** `ExecutionPlan` — lista ordenada de steps para o Executor.

### Phase 3: Act (Ação)

Execução do plano pelo `executor`.

```yaml
act:
  executor: contracts/executor.md
  input: ExecutionPlan
  output: ExecutionReport
  timeout: 300s
```

**Saída:** `ExecutionReport` — resultado consolidado das ações tomadas.

## Cycle Hooks

```
pre_run   → [Perceive] → [Think] → [Act] → post_run
```

- `pre_run`: carrega contexto, valida estado inicial.
- `post_run`: consolida memória, emite métricas do ciclo.

## Loop Termination Conditions

O loop é encerrado quando qualquer condição abaixo for verdadeira:

| Condição                        | Comportamento                      |
|---------------------------------|------------------------------------|
| `max_iterations` atingido       | Encerra normalmente                |
| Sinal `SIGTERM` recebido        | Finaliza ciclo atual e encerra     |
| Erro crítico irrecuperável      | Aciona `on_error` hook e encerra   |
| Comando explícito de shutdown   | Encerra após ciclo corrente        |

## Cycle Metadata

Cada ciclo gera um identificador rastreável:

```json
{
  "cycle_id": "cycle-042",
  "started_at": "2026-06-06T14:41:00Z",
  "phase_durations_ms": {
    "perceive": 210,
    "think": 430,
    "act": 1840
  },
  "total_duration_ms": 2480,
  "status": "completed"
}
```
