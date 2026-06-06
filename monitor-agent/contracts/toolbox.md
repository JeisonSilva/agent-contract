# Toolbox — Tool Definitions

## Overview

O Toolbox é o catálogo de **todas as ferramentas e funções** que o agente pode invocar. Nenhuma ferramenta externa deve ser chamada sem estar registrada aqui — este é o ponto único de governança de capacidades de execução.

## Tool Registry

### Observability Tools

#### `fetch_metrics`

Coleta métricas de sistemas monitorados.

```yaml
tool: fetch_metrics
description: Busca séries temporais de métricas de um serviço.
inputs:
  service:
    type: string
    required: true
    description: Nome do serviço (ex: "api-gateway")
  metric:
    type: string | list[string]
    required: true
    enum: [cpu, memory, latency, error_rate, throughput, saturation]
  window:
    type: duration
    required: true
    description: Janela temporal (ex: "5m", "1h", "24h")
  aggregation:
    type: string
    default: avg
    enum: [avg, p50, p95, p99, max, min, sum]
outputs:
  type: MetricsSeries
  schema:
    service: string
    metric: string
    datapoints: list[{timestamp, value}]
    unit: string
timeout: 10s
```

#### `fetch_logs`

Recupera logs estruturados de serviços.

```yaml
tool: fetch_logs
description: Busca logs de um serviço para análise.
inputs:
  service:
    type: string
    required: true
  level:
    type: string
    enum: [ERROR, WARN, INFO, DEBUG]
    default: ERROR
  window:
    type: duration
    required: true
  limit:
    type: integer
    default: 500
    max: 5000
  filter:
    type: string
    description: Expressão de filtro adicional (opcional)
outputs:
  type: LogBatch
  schema:
    entries: list[LogEntry]
    total_count: integer
    truncated: boolean
timeout: 15s
```

#### `detect_anomaly`

Detecção automática de anomalias em séries temporais.

```yaml
tool: detect_anomaly
description: Identifica anomalias estatísticas em uma série de métricas.
inputs:
  series: MetricsSeries
  sensitivity:
    type: string
    enum: [low, medium, high]
    default: medium
outputs:
  type: AnomalyReport
  schema:
    anomalies: list[AnomalyEvent]
    baseline: StatisticalSummary
    score: float  # 0.0 a 1.0
timeout: 5s
```

### Incident Management Tools

#### `notify_oncall`

Envia alerta para o time de plantão.

```yaml
tool: notify_oncall
description: Aciona notificação para o engenheiro de plantão.
inputs:
  severity:
    type: string
    required: true
    enum: [P1, P2, P3, P4]
  title:
    type: string
    required: true
    max_length: 120
  cause:
    type: string
    required: true
  context:
    type: dict
    description: Dados adicionais de contexto (opcional)
  channels:
    type: list[string]
    default: [slack, pagerduty]
outputs:
  type: NotificationReceipt
  schema:
    notification_id: string
    delivered_to: list[string]
    timestamp: datetime
timeout: 10s
requires_confirmation: false  # P1/P2 enviam imediatamente
```

#### `query_runbook`

Consulta a base de runbooks para ações recomendadas.

```yaml
tool: query_runbook
description: Busca procedimentos de resposta a incidentes.
inputs:
  incident_type:
    type: string
    required: true
  service:
    type: string
    required: false
outputs:
  type: RunbookEntry
  schema:
    title: string
    steps: list[string]
    escalation_path: list[string]
    estimated_resolution_time: duration
timeout: 5s
```

### Analysis Tools

#### `run_forecast_model`

Executa modelo de previsão de capacidade.

```yaml
tool: run_forecast_model
description: Gera previsão de utilização futura de recursos.
inputs:
  series: MetricsSeries
  horizon:
    type: duration
    required: true
  model:
    type: string
    default: prophet
    enum: [prophet, arima, linear_regression]
outputs:
  type: ForecastResult
  schema:
    predictions: list[{timestamp, value, lower_bound, upper_bound}]
    saturation_date: datetime | null
    confidence: float
timeout: 30s
```

#### `cluster_log_patterns`

Agrupa logs por padrão para identificar erros recorrentes.

```yaml
tool: cluster_log_patterns
description: Clusteriza mensagens de log por similaridade.
inputs:
  logs: LogBatch
  max_clusters:
    type: integer
    default: 10
outputs:
  type: ClusterReport
  schema:
    clusters: list[{pattern, count, examples, first_seen, last_seen}]
timeout: 20s
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
  "tool": "fetch_metrics",
  "error_code": "TIMEOUT",
  "message": "Request exceeded 10s timeout",
  "retryable": true,
  "timestamp": "2026-06-06T14:41:00Z"
}
```
