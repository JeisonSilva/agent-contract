# Memory — Context Management

## Overview

A memória do agente é dividida em camadas com escopos e durabilidades distintas, seguindo o modelo de **Arquitetura Cognitiva** inspirado na psicologia cognitiva humana.

## Memory Configuration

```yaml
memory:
  short_term:
    type: sliding_window
    max_tokens: 8192
    ttl: session          # descartado ao fim do ciclo
    description: >
      Janela de contexto ativo. Contém as últimas N mensagens,
      resultados de ferramentas e observações do ciclo corrente.

  long_term:
    type: vector_store
    backend: chroma       # ou pinecone, pgvector, etc.
    max_entries: 10000
    ttl: persistent       # persiste entre sessões
    retrieval:
      strategy: semantic_similarity
      top_k: 5
      score_threshold: 0.75
    description: >
      Base de conhecimento acumulada. Armazena resumos de ciclos
      anteriores, fatos importantes e padrões aprendidos.

  working_memory:
    type: key_value
    max_entries: 50
    ttl: task             # descartado ao fim de uma tarefa
    description: >
      Estado temporário de uma tarefa em andamento.
      Ex: variáveis intermediárias de um plano multi-step.

  episodic:
    type: append_log
    max_entries: 1000
    ttl: persistent
    description: >
      Log cronológico de eventos significativos.
      Permite ao agente raciocinar sobre seu próprio histórico.
```

## Memory Lifecycle

```
Ciclo Inicia
    │
    ▼
[Recall] → busca long_term + episodic relevantes → injeta em short_term
    │
    ▼
[Execução] → operações leem/escrevem working_memory e short_term
    │
    ▼
[Consolidação] → ao fim do ciclo, sumariza short_term → long_term + episodic
    │
    ▼
Ciclo Termina
```

## Retrieval Strategy

| Tipo           | Estratégia       | Quando usar                              |
|----------------|------------------|------------------------------------------|
| Semântica      | Embedding + ANN  | Busca por conceitos relacionados         |
| Exata          | BM25 / Full-text | IDs, nomes de serviços, valores precisos |
| Temporal       | Ordenação por ts | Últimos N eventos ou mudanças recentes   |
| Estruturada    | SQL / KV lookup  | Fatos categorizados e metadados          |

## Memory Limits & Eviction

- **Short-term**: descartar mensagens mais antigas (FIFO) quando `max_tokens` for atingido.
- **Long-term**: política LRU + score de relevância; entradas com score baixo são arquivadas.
- **Working**: limpeza explícita ao sinalizar `task_complete`.
