/**
 * Basic usage example: agent-fast-execute runner with LangGraph
 *
 * Requirements:
 *   ANTHROPIC_API_KEY env var must be set.
 *   Run from runner/: node examples/basic.js
 *
 * Agent behavior (persona, strategy, tools, rules, memory) is driven
 * entirely by the markdown contracts in agent-fast-execute/. Only the
 * tool execute functions are provided here — everything else comes from
 * the .md files.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { loadAgent } from '../src/index.js';

const llm = new ChatAnthropic({
  model: 'claude-haiku-4-5-20251001',
  temperature: 0,
});

// Load agent from markdown contracts (reads all .md files in agent-fast-execute/)
const agent = await loadAgent({ llm });

// ── Register tool execute functions ──────────────────────────────────────────
// Schema, description, and timeout come from contracts/toolbox.md.
// Only the execute logic is needed here.

agent.registerTool('calculator', async ({ expression }) => {
  if (!/^[\d\s+\-*/().%]+$/.test(expression)) {
    throw new Error('Invalid expression: only arithmetic operators allowed.');
  }
  const result = Function(`"use strict"; return (${expression})`)();
  return { expression, result };
});

agent.registerTool('is_prime', async ({ n }) => {
  if (n < 2) return { n, is_prime: false };
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return { n, is_prime: false, factor: i };
  }
  return { n, is_prime: true };
});

// ── Wire observability hooks ──────────────────────────────────────────────────

agent.hooks.register('pre_run', ({ cycle_id, iteration }) => {
  console.log(`\n[pre_run]  cycle=${cycle_id}  iteration=${iteration}`);
});

agent.hooks.register('on_tool_call', ({ tool, inputs }) => {
  console.log(`[tool →]   ${tool}(${JSON.stringify(inputs)})`);
});

agent.hooks.register('on_tool_result', ({ tool, result, duration_ms }) => {
  const out = result ? JSON.stringify(result).slice(0, 80) : '(error)';
  console.log(`[tool ←]   ${tool} → ${out}  (${duration_ms}ms)`);
});

agent.hooks.register('on_error', ({ step, error }) => {
  console.error(`[error]    step=${step ?? 'unknown'}  ${error}`);
});

agent.hooks.register('post_run', ({ cycle_id, tool_calls_made, status }) => {
  console.log(`[post_run] cycle=${cycle_id}  tools_called=${tool_calls_made}  status=${status}\n`);
});

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('=== agent-fast-execute runner — LangGraph ===');
console.log(`Agent    : ${agent.config.identity.name ?? 'agent-fast-execute'}`);
console.log(`Mode     : ${agent.config.loop.mode}`);
console.log(`Strategy : ${agent.config.planner.default_strategy}`);
console.log(`Tools    : ${agent.config.tools.map(t => t.name).join(', ') || '(none in toolbox.md)'}`);
console.log();

const finalState = await agent.run(
  'Calculate 42 * 37 and then check whether the result is a prime number.',
);

const lastMsg = finalState.messages[finalState.messages.length - 1];
console.log('=== Final Answer ===');
console.log(lastMsg?.content ?? '(no response)');

console.log('\n=== Episodic Log ===');
console.log(JSON.stringify(finalState.episodic, null, 2));
