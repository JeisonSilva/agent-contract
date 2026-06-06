import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState } from './state.js';
import { preRunNode, perceiveNode, thinkNode, actNode, consolidateNode } from './loop.js';

const MAX_TOOL_CALLS_PER_TASK = 20;

// ── Routing functions ─────────────────────────────────────────────────────────

// After think: tool calls pending → act; final answer → consolidate
function routeAfterThink(state) {
  if (state.status === 'ABORTED' || state.status === 'FAILED') return END;
  const last = state.messages[state.messages.length - 1];
  const hasToolCalls = (last?.tool_calls?.length ?? 0) > 0;
  if (hasToolCalls && state.tool_call_count < MAX_TOOL_CALLS_PER_TASK) return 'act';
  return 'consolidate';
}

// After act: always return to think so LLM can process tool results
function routeAfterAct(state) {
  if (state.status === 'ABORTED') return END;
  return 'think';
}

// After consolidate: in continuous mode loop back; in triggered mode finish
function routeAfterConsolidate(state) {
  const mode = state.config?.mode ?? 'triggered';
  if (mode === 'continuous' && state.iteration < state.max_iterations) {
    return 'perceive';
  }
  return END;
}

// ── Graph factory ─────────────────────────────────────────────────────────────

export function createAgentGraph() {
  const graph = new StateGraph(AgentState)
    .addNode('pre_run', preRunNode)
    .addNode('perceive', perceiveNode)
    .addNode('think', thinkNode)
    .addNode('act', actNode)
    .addNode('consolidate', consolidateNode)

    // Entry
    .addEdge(START, 'pre_run')
    .addEdge('pre_run', 'perceive')
    .addEdge('perceive', 'think')

    // Inner loop: think ↔ act (tool-calling cycle)
    .addConditionalEdges('think', routeAfterThink, {
      act: 'act',
      consolidate: 'consolidate',
      [END]: END,
    })
    .addConditionalEdges('act', routeAfterAct, {
      think: 'think',
      [END]: END,
    })

    // Outer loop: consolidate → perceive (continuous) or END (triggered)
    .addConditionalEdges('consolidate', routeAfterConsolidate, {
      perceive: 'perceive',
      [END]: END,
    });

  return graph.compile();
}
