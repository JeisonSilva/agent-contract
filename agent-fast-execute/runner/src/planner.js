export const STRATEGIES = {
  REACT: 'react',
  COT: 'chain_of_thought',
  MAP_REDUCE: 'map_reduce',
  TOT: 'tree_of_thought',
};

const MAX_PLAN_STEPS = 20;

const STRATEGY_INSTRUCTIONS = {
  [STRATEGIES.REACT]: `You operate in **ReAct mode** (Reason + Act).
For each step: reason about what you know → choose a tool → observe the result → repeat until done.
Think out loud before each tool call. Adapt based on tool outputs.`,

  [STRATEGIES.COT]: `You operate in **Chain-of-Thought mode**.
First reason through the full problem step by step. Then execute your plan using the available tools.
Complete your reasoning before making any tool calls.`,

  [STRATEGIES.MAP_REDUCE]: `You operate in **Map-Reduce mode**.
Break the problem into independent sub-problems. Gather data from multiple sources in parallel using tools,
then synthesize the results into a unified conclusion.`,

  [STRATEGIES.TOT]: `You operate in **Tree-of-Thought mode**.
Generate multiple solution hypotheses. Estimate the probability of each.
Pursue the most promising hypothesis first, falling back if evidence contradicts it.`,
};

export function selectStrategy(task, config = {}) {
  if (config.strategy && STRATEGY_INSTRUCTIONS[config.strategy]) return config.strategy;
  if (task?.strategy) return task.strategy;
  return STRATEGIES.REACT;
}

export function buildSystemPrompt(strategy, tools) {
  const toolList = tools.length
    ? tools.map((t) => `  - **${t.name}**: ${t.description ?? 'no description'}`).join('\n')
    : '  (no tools registered)';

  return `You are **agent-fast-execute**, a modular cognitive agent.

## Reasoning Strategy
${STRATEGY_INSTRUCTIONS[strategy] ?? STRATEGY_INSTRUCTIONS[STRATEGIES.REACT]}

## Available Tools
${toolList}

## Constraints
- Maximum ${MAX_PLAN_STEPS} tool calls per task.
- Be precise and evidence-based. Express confidence levels when uncertain.
- Always produce structured, verifiable outputs.
- Validate inputs before calling tools.
- When done, provide a clear final answer without calling additional tools.`;
}
