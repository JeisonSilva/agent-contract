/**
 * Basic usage example: agent-fast-execute runner with LangGraph
 *
 * Requirements:
 *   ANTHROPIC_API_KEY env var must be set.
 *   Run: node examples/basic.js
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { createAgentGraph, registerTool, hooks } from '../src/index.js';

// ── Register tools ────────────────────────────────────────────────────────────

registerTool({
  name: 'calculator',
  description: 'Evaluate a safe arithmetic expression and return the numeric result.',
  inputs: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Arithmetic expression, e.g. "42 * 37"' },
    },
    required: ['expression'],
  },
  execute: async ({ expression }) => {
    // Restrict to safe arithmetic only
    if (!/^[\d\s+\-*/().%]+$/.test(expression)) {
      throw new Error('Invalid expression: only arithmetic operators allowed.');
    }
    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${expression})`)();
    return { expression, result };
  },
});

registerTool({
  name: 'is_prime',
  description: 'Check whether a given integer is a prime number.',
  inputs: {
    type: 'object',
    properties: {
      n: { type: 'integer', description: 'The number to check' },
    },
    required: ['n'],
  },
  execute: async ({ n }) => {
    if (n < 2) return { n, is_prime: false };
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return { n, is_prime: false, factor: i };
    }
    return { n, is_prime: true };
  },
});

// ── Wire up hooks (observability) ─────────────────────────────────────────────

hooks.register('pre_run', ({ cycle_id, iteration }) => {
  console.log(`\n[pre_run]  cycle=${cycle_id}  iteration=${iteration}`);
});

hooks.register('on_tool_call', ({ tool, inputs }) => {
  console.log(`[tool →]   ${tool}(${JSON.stringify(inputs)})`);
});

hooks.register('on_tool_result', ({ tool, result, duration_ms }) => {
  const out = result ? JSON.stringify(result).slice(0, 80) : '(error)';
  console.log(`[tool ←]   ${tool} → ${out}  (${duration_ms}ms)`);
});

hooks.register('on_error', ({ step, error }) => {
  console.error(`[error]    step=${step ?? 'unknown'}  ${error}`);
});

hooks.register('post_run', ({ cycle_id, tool_calls_made, status }) => {
  console.log(`[post_run] cycle=${cycle_id}  tools_called=${tool_calls_made}  status=${status}\n`);
});

// ── Run ───────────────────────────────────────────────────────────────────────

const llm = new ChatAnthropic({
  model: 'claude-haiku-4-5-20251001',
  temperature: 0,
});

const agent = createAgentGraph();

console.log('=== agent-fast-execute runner — LangGraph ===');

const finalState = await agent.invoke(
  {
    task: 'Calculate 42 * 37 and then check whether the result is a prime number.',
    max_iterations: 10,
    config: { mode: 'triggered', strategy: 'react' },
  },
  {
    configurable: { llm },
  }
);

// Print the final LLM answer
const lastMsg = finalState.messages[finalState.messages.length - 1];
console.log('=== Final Answer ===');
console.log(lastMsg?.content ?? '(no response)');

console.log('\n=== Episodic Log ===');
console.log(JSON.stringify(finalState.episodic, null, 2));
