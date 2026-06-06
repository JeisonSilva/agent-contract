import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';

export const AgentState = Annotation.Root({
  // Identity
  agent_id: Annotation({ reducer: (a, b) => b ?? a, default: () => 'agent-fast-execute' }),
  cycle_id: Annotation({ reducer: (a, b) => b ?? a, default: () => uuidv4() }),

  // Task input
  task: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // Agent configuration (mode, strategy, etc.)
  config: Annotation({
    reducer: (a, b) => ({ ...(a ?? {}), ...(b ?? {}) }),
    default: () => ({ mode: 'triggered', strategy: 'react' }),
  }),

  // Outer loop control (P-T-A cycles)
  iteration: Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),
  max_iterations: Annotation({ reducer: (a, b) => b ?? a, default: () => 10 }),

  // Inner loop control (tool call turns within one task)
  tool_call_count: Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),

  // Current phase
  phase: Annotation({ reducer: (a, b) => b ?? a, default: () => 'PERCEIVE' }),

  // LLM conversation messages (accumulates within a task cycle)
  messages: Annotation({ reducer: messagesStateReducer, default: () => [] }),

  // Perceive phase output
  observations: Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),

  // Think phase output
  strategy: Annotation({ reducer: (a, b) => b ?? a, default: () => 'react' }),

  // Act phase accumulated results
  results: Annotation({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),

  // Memory layers
  short_term: Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  working: Annotation({
    reducer: (a, b) => ({ ...(a ?? {}), ...(b ?? {}) }),
    default: () => ({}),
  }),
  episodic: Annotation({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),

  // Status and error tracking
  status: Annotation({ reducer: (a, b) => b ?? a, default: () => 'RUNNING' }),
  error: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // Timing metadata
  started_at: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  phase_durations: Annotation({
    reducer: (a, b) => ({ ...(a ?? {}), ...(b ?? {}) }),
    default: () => ({}),
  }),
});
