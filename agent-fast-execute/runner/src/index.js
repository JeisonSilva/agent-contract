// Public API for @agent-fast-execute/runner
export { createAgentGraph } from './agent.js';
export { AgentState } from './state.js';
export { hooks } from './hooks.js';
export { registerTool, registerToolSchema, getTool, listTools, callTool, createToolError, ERROR_CODES } from './toolbox.js';
export { STRATEGIES, selectStrategy, buildSystemPrompt } from './planner.js';
export { executePlan, STEP_STATUS } from './executor.js';
export {
  consolidateShortTerm,
  recallShortTerm,
  setWorking,
  getWorking,
  buildEpisodicEntry,
  recallEpisodic,
} from './memory.js';
export { loadAgentConfig, DEFAULT_CONTRACTS_DIR } from './loader.js';

// ── High-level factory ────────────────────────────────────────────────────────
// Reads all .md contracts, wires config into the graph, and returns a
// simple { registerTool, hooks, run, config } interface.

import { loadAgentConfig, DEFAULT_CONTRACTS_DIR } from './loader.js';
import { createAgentGraph } from './agent.js';
import { registerTool as _registerTool, registerToolSchema } from './toolbox.js';
import { hooks } from './hooks.js';

export async function loadAgent({ contractsDir = DEFAULT_CONTRACTS_DIR, llm } = {}) {
  const agentConfig = loadAgentConfig(contractsDir);

  // Pre-load tool schemas from contracts/toolbox.md into the registry
  for (const toolDef of agentConfig.tools) {
    registerToolSchema(toolDef);
  }

  const graph = createAgentGraph(agentConfig);

  return {
    config: agentConfig,
    hooks,

    // Only the execute function is needed — schema comes from toolbox.md
    registerTool(name, execute) {
      const schema = agentConfig.tools.find(t => t.name === name) ?? {};
      _registerTool({ name, ...schema, execute });
    },

    async run(task, options = {}) {
      const maxIter = isFinite(agentConfig.loop.max_iterations)
        ? agentConfig.loop.max_iterations
        : (options.max_iterations ?? 10);

      return graph.invoke(
        {
          task,
          max_iterations: options.max_iterations ?? maxIter,
          config: {
            mode: agentConfig.loop.mode,
            strategy: agentConfig.planner.default_strategy,
            ...options.config,
          },
        },
        { configurable: { llm, agentConfig } },
      );
    },
  };
}
