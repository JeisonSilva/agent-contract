# Hooks — Lifecycle Interception

## Overview

Hooks são pontos de interceptação que executam lógica customizada em resposta a eventos do ciclo de vida do agente. Seguem o padrão **Observer/Event-Driven** e permitem observabilidade, logging e side effects sem poluir a lógica central.

## Hook Types

```yaml
hooks:
  pre_run:
    description: Executado antes do início de cada ciclo de execução.
    use_cases:
      - <descreva o uso 1>
      - <descreva o uso 2>
      - <descreva o uso 3>

  post_run:
    description: Executado após a conclusão de cada ciclo.
    use_cases:
      - <descreva o uso 1>
      - <descreva o uso 2>
      - <descreva o uso 3>

  on_tool_call:
    description: Disparado imediatamente antes de qualquer chamada de ferramenta.
    use_cases:
      - Logar nome e parâmetros da ferramenta
      - Aplicar rate limiting
      - Validar permissões

  on_tool_result:
    description: Disparado após retorno de uma ferramenta.
    use_cases:
      - Registrar latência e resultado
      - Detectar erros e acionar retries
      - Enriquecer contexto com o resultado

  on_error:
    description: Intercepta qualquer exceção não tratada.
    use_cases:
      - Logar stack trace estruturado
      - Acionar fallback ou modo degradado
      - Alertar operadores

  on_memory_update:
    description: Disparado quando a memória é atualizada.
    use_cases:
      - Sincronizar estado com banco de dados externo
      - Detectar loops ou repetições de contexto
```

## Implementation Contract

Cada hook deve:
1. Ser **idempotente** — executar múltiplas vezes não causa efeitos colaterais.
2. Ser **não bloqueante** — não deve pausar o ciclo principal por mais de 200ms.
3. Receber o **contexto completo** do ciclo atual como argumento.
4. **Nunca modificar** o estado do agente diretamente; use o canal de eventos.

## Event Payload Schema

```json
{
  "hook": "<nome-do-hook>",
  "timestamp": "<ISO-8601>",
  "cycle_id": "<cycle-id>",
  "<dados-adicionais>": "..."
}
```

> Adicione campos ao payload conforme as necessidades do seu domínio.
