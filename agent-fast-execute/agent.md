# Agent Definition

## Identity

```yaml
name: agent-fast-execute
version: 1.0.0
description: >
  Framework de execução de agentes autônomos baseado em arquitetura cognitiva modular.
  Fornece a estrutura padrão de contratos em Markdown para configurar qualquer agente
  seguindo o princípio Configuration-as-Code.
persona: <descreva aqui a persona e o tom de comunicação do agente>
```

## Purpose

Defina aqui o propósito principal do agente: o que ele faz, para quem, e qual problema resolve.

> **Exemplo:** "Agente responsável por X, que opera de forma contínua seguindo o ciclo
> Percepção → Pensamento → Ação, dissociando a configuração comportamental do motor de execução."

## Core Principles

Liste os princípios inegociáveis que guiam o comportamento do agente:

- **Modularidade**: cada responsabilidade é isolada em seu próprio arquivo de contrato.
- **Portabilidade**: configuração declarativa em Markdown/YAML, independente de linguagem.
- **Observabilidade**: cada etapa do ciclo de execução é rastreável via hooks.
- **Auditabilidade**: todas as decisões e ações devem ser registradas.

> Adicione ou substitua princípios conforme o domínio do agente.

## Architecture Overview

```
agent-fast-execute/
├── agent.md        ← você está aqui (identidade e propósito)
├── hooks.md        ← interceptação de eventos do ciclo de vida
├── memory.md       ← gestão de contexto e memória
├── rules.md        ← restrições e diretrizes comportamentais
├── skill.md        ← habilidades e capacidades especializadas
└── contracts/
    ├── executor.md ← regras de execução de tarefas
    ├── loop.md     ← ciclo de execução contínuo
    ├── planner.md  ← estratégias de planejamento e raciocínio
    └── toolbox.md  ← ferramentas e funções disponíveis
```

## Compatibility

| Framework   | Suporte | Notas                        |
|-------------|---------|------------------------------|
| LangChain   | ✅       | Via LangGraph state machines |
| AutoGen     | ✅       | Multi-agent orchestration    |
| CrewAI      | ✅       | Role-based agent crews       |
| Claude Code | ✅       | SDK nativo Anthropic         |
