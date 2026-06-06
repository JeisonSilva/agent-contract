export const STRATEGIES = {
  REACT: 'react',
  COT: 'chain_of_thought',
  MAP_REDUCE: 'map_reduce',
  TOT: 'tree_of_thought',
};

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

function notTemplate(val) {
  return val && typeof val === 'string' && !(/^<.*>$/.test(val.trim()));
}

// agentConfig is the object returned by loadAgentConfig()
export function selectStrategy(task, config = {}, agentConfig = {}) {
  if (config.strategy && STRATEGY_INSTRUCTIONS[config.strategy]) return config.strategy;
  if (task?.strategy) return task.strategy;
  const def = agentConfig.planner?.default_strategy;
  if (def && STRATEGY_INSTRUCTIONS[def]) return def;
  return STRATEGIES.REACT;
}

export function buildSystemPrompt(strategy, tools, agentConfig = {}) {
  const identity   = agentConfig.identity ?? {};
  const name       = notTemplate(identity.name)        ? identity.name        : 'agent-fast-execute';
  const persona    = notTemplate(identity.persona)     ? identity.persona     : 'a modular cognitive agent';
  const desc       = notTemplate(identity.description) ? identity.description : null;
  const maxSteps   = agentConfig.planner?.max_plan_steps ?? 20;
  const rules      = agentConfig.rules ?? '';

  const toolList = tools.length
    ? tools.map((t) => `  - **${t.name}**: ${t.description || 'no description'}`).join('\n')
    : '  (no tools registered)';

  const parts = [`You are **${name}**, ${persona}.`];
  if (desc) parts.push(`\n${desc}`);
  parts.push(`\n## Reasoning Strategy\n${STRATEGY_INSTRUCTIONS[strategy] ?? STRATEGY_INSTRUCTIONS[STRATEGIES.REACT]}`);
  parts.push(`\n## Available Tools\n${toolList}`);
  if (rules) parts.push(`\n## Rules and Constraints\n${rules}`);
  parts.push(`\n## General Constraints\n- Maximum ${maxSteps} tool calls per task.\n- Be precise and evidence-based. Express confidence levels when uncertain.\n- Validate inputs before calling tools.\n- When done, provide a clear final answer without calling additional tools.`);

  return parts.join('\n');
}
