import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState } from './state.js';
import { preRunNode, perceiveNode, thinkNode, actNode, consolidateNode } from './loop.js';

// ── Graph factory ─────────────────────────────────────────────────────────────
// agentConfig is the object from loadAgentConfig() — drives routing and limits

export function createAgentGraph(agentConfig = {}) {
  const loopConfig   = agentConfig.loop ?? {};
  const plannerConfig = agentConfig.planner ?? {};
  const maxToolCalls = plannerConfig.max_plan_steps ?? 20;

  // After think: tool calls pending → act; final answer → consolidate
  function routeAfterThink(state) {
    if (state.status === 'ABORTED' || state.status === 'FAILED') return END;
    const last = state.messages[state.messages.length - 1];
    const hasToolCalls = (last?.tool_calls?.length ?? 0) > 0;
    if (hasToolCalls && state.tool_call_count < maxToolCalls) return 'act';
    return 'consolidate';
  }

  // After act: always return to think so LLM can process tool results
  function routeAfterAct(state) {
    if (state.status === 'ABORTED') return END;
    return 'think';
  }

  // After consolidate: continuous mode loops back; triggered mode finishes
  function routeAfterConsolidate(state) {
    const mode    = loopConfig.mode ?? state.config?.mode ?? 'triggered';
    const maxIter = isFinite(loopConfig.max_iterations)
      ? loopConfig.max_iterations
      : (state.max_iterations ?? 10);
    if (mode === 'continuous' && state.iteration < maxIter) return 'perceive';
    return END;
  }

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
