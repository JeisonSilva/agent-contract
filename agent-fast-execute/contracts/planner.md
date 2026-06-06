# Planner — Problem-Solving Strategies

## Overview

O Planner é responsável por **decompor observações complexas em planos de execução** — sequências de steps que o Executor pode processar. Implementa múltiplas estratégias de raciocínio adaptadas ao tipo de problema.

## Planner Configuration

```yaml
planner:
  default_strategy: react
  max_plan_steps: 20
  max_reasoning_tokens: 4096
  fallback_strategy: chain_of_thought
  allow_dynamic_replanning: true   # replanejar mid-task se contexto mudar
```

## Reasoning Strategies

### 1. ReAct (Reason + Act)

Intercala raciocínio explícito com ações, permitindo adaptação baseada em resultados intermediários.

```
Thought: Preciso verificar se a latência do api-gateway está alta.
Action: fetch_metrics(service="api-gateway", metric="latency", window="5m")
Observation: p99=2400ms, threshold=500ms — claramente acima do limite.
Thought: Latência está 4.8x acima do threshold. Verificar logs para identificar causa.
Action: fetch_logs(service="api-gateway", level="ERROR", window="5m")
Observation: 847 erros de timeout para downstream auth-service.
Thought: Causa identificada. Acionar alerta de P1 e notificar on-call.
Action: notify_oncall(severity="P1", cause="auth-service timeout cascade")
```

**Usar quando:** problema requer investigação iterativa com feedback de ferramentas.

### 2. Chain-of-Thought (CoT)

Raciocínio linear passo a passo antes de executar qualquer ação.

```
1. Analisar a observação recebida (métricas, alertas, logs).
2. Identificar o componente afetado e o tipo de anomalia.
3. Consultar runbook para padrões conhecidos.
4. Construir hipótese de causa raiz.
5. Definir ações corretivas em ordem de prioridade.
6. Executar todas as ações do plano.
```

**Usar quando:** problema é bem-compreendido e o plano pode ser definido antecipadamente.

### 3. Map-Reduce

Divide um problema em subproblemas paralelos e consolida os resultados.

```yaml
map_reduce:
  map_phase:
    - fetch_metrics(service="api-gateway")
    - fetch_metrics(service="auth-service")
    - fetch_metrics(service="payment-service")
  reduce_phase:
    - aggregate_metrics(results=map_outputs)
    - identify_outliers(aggregated=reduce_input)
```

**Usar quando:** análise deve cobrir múltiplos serviços ou fontes de dados em paralelo.

### 4. Tree-of-Thought (ToT)

Explora múltiplos caminhos de raciocínio e seleciona o mais promissor.

```
Hipótese A: Problema de capacidade (CPU/Memória)
  → Verificar: fetch_metrics(type="cpu,memory")
  → Probabilidade estimada: 30%

Hipótese B: Cascata de timeouts downstream
  → Verificar: fetch_logs(level="ERROR") + check_dependencies()
  → Probabilidade estimada: 60%

Hipótese C: Deploy recente introduziu regressão
  → Verificar: get_recent_deploys() + compare_metrics_before_after()
  → Probabilidade estimada: 10%

→ Selecionar Hipótese B para investigação prioritária.
```

**Usar quando:** múltiplas causas raiz são plausíveis e precisam ser avaliadas.

## Strategy Selection Matrix

| Tipo de Problema              | Estratégia Recomendada |
|-------------------------------|------------------------|
| Investigação iterativa        | ReAct                  |
| Análise estruturada conhecida | Chain-of-Thought       |
| Cobertura ampla / multi-fonte | Map-Reduce             |
| Múltiplas hipóteses           | Tree-of-Thought        |
| Fallback genérico             | Chain-of-Thought       |

## Plan Output Schema

```json
{
  "plan_id": "plan-007",
  "strategy": "react",
  "steps": [
    {
      "id": "step-1",
      "tool": "fetch_metrics",
      "inputs": { "service": "api-gateway", "metric": "latency", "window": "5m" },
      "depends_on": []
    },
    {
      "id": "step-2",
      "tool": "fetch_logs",
      "inputs": { "service": "api-gateway", "level": "ERROR", "window": "5m" },
      "depends_on": ["step-1"]
    }
  ],
  "estimated_duration_s": 45,
  "replanning_allowed": true
}
```
