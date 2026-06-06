# Skills — Agent Capabilities

## Overview

Skills são **habilidades especializadas** que o agente domina — capacidades compostas que combinam ferramentas, memória e raciocínio para entregar valor em um domínio específico.

## Registered Skills

### 1. `metrics_analysis`

Análise estatística de séries temporais de métricas de sistemas.

```yaml
skill: metrics_analysis
inputs:
  - service_name: string
  - metric_type: [cpu, memory, latency, error_rate]
  - time_window: duration  # ex: "1h", "24h"
outputs:
  - trend: [stable, degrading, improving, anomalous]
  - summary: string
  - anomalies: list[AnomalyEvent]
tools_required:
  - fetch_metrics
  - detect_anomaly
reasoning_pattern: chain_of_thought
```

### 2. `incident_triage`

Classificação e priorização automática de incidentes detectados.

```yaml
skill: incident_triage
inputs:
  - alert: AlertPayload
  - context: SystemContext
outputs:
  - severity: [P1, P2, P3, P4]
  - probable_cause: string
  - recommended_actions: list[Action]
  - escalate: boolean
tools_required:
  - fetch_logs
  - query_runbook
  - notify_oncall
reasoning_pattern: react  # Reason + Act iterativo
```

### 3. `capacity_forecast`

Previsão de capacidade e detecção de tendências de saturação.

```yaml
skill: capacity_forecast
inputs:
  - service_name: string
  - forecast_horizon: duration  # ex: "7d", "30d"
outputs:
  - saturation_date: datetime | null
  - confidence_interval: [lower, upper]
  - recommendation: string
tools_required:
  - fetch_metrics
  - run_forecast_model
reasoning_pattern: chain_of_thought
```

### 4. `log_summarization`

Sumarização inteligente de volumes grandes de logs.

```yaml
skill: log_summarization
inputs:
  - service_name: string
  - log_level: [ERROR, WARN, INFO]
  - time_window: duration
outputs:
  - summary: string
  - top_errors: list[ErrorPattern]
  - frequency_map: dict[string, int]
tools_required:
  - fetch_logs
  - cluster_log_patterns
reasoning_pattern: map_reduce
```

## Skill Composition

Skills podem ser compostas pelo `planner` para resolver tarefas complexas:

```
incident_triage
    └── metrics_analysis   (verificar contexto de métricas)
    └── log_summarization  (verificar logs do período)
    └── capacity_forecast  (avaliar se é problema de capacidade)
```

## Adding New Skills

1. Definir inputs/outputs com tipos explícitos.
2. Listar todas as `tools_required` (devem existir em `contracts/toolbox.md`).
3. Especificar o `reasoning_pattern` adequado.
4. Adicionar casos de teste em `contracts/executor.md`.
