import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { hooks } from './hooks.js';
import { consolidateShortTerm, buildEpisodicEntry, serializeMessages } from './memory.js';
import { listTools, toLangChainTools, callTool } from './toolbox.js';
import { buildSystemPrompt, selectStrategy } from './planner.js';

const MAX_TOOL_CALLS_PER_TASK = 20;

// ── Node: pre_run ─────────────────────────────────────────────────────────────
// Fires pre_run hook and initialises cycle metadata
export async function preRunNode(state) {
  const started_at = Date.now();

  await hooks.fire('pre_run', {
    cycle_id: state.cycle_id,
    iteration: state.iteration,
    task: state.task,
  });

  return {
    started_at,
    status: 'RUNNING',
    phase: 'PERCEIVE',
    tool_call_count: 0,
  };
}

// ── Node: perceive ────────────────────────────────────────────────────────────
// Collects observations and loads relevant short-term context
export async function perceiveNode(state) {
  const t0 = Date.now();

  const observations = [
    {
      source: 'task_input',
      type: 'task',
      data: state.task,
      timestamp: new Date().toISOString(),
    },
    // Additional sources (metrics_stream, alert_queue, log_tail) would be
    // injected here in domain-specific subclasses
  ];

  return {
    phase: 'THINK',
    observations,
    phase_durations: { perceive: Date.now() - t0 },
  };
}

// ── Node: think ───────────────────────────────────────────────────────────────
// Runs the LLM with the current conversation and registered tools
export async function thinkNode(state, config) {
  const t0 = Date.now();
  const llm = config.configurable?.llm;
  if (!llm) throw new Error('LLM not configured. Pass { configurable: { llm } } to agent.invoke().');

  const strategy = selectStrategy(state.task, state.config);
  const tools = listTools();
  const systemPrompt = buildSystemPrompt(strategy, tools);

  // Build the conversation for this call
  let callMessages = [...state.messages];
  const newMessages = [];

  // First turn: add the task as the initial HumanMessage
  if (callMessages.length === 0) {
    const taskContent = typeof state.task === 'string' ? state.task : JSON.stringify(state.task, null, 2);
    const taskMsg = new HumanMessage(taskContent);
    newMessages.push(taskMsg);
    callMessages = [taskMsg];
  }

  // Bind tools to the LLM for tool-calling support
  const lcTools = toLangChainTools();
  const boundLLM = lcTools.length > 0 && typeof llm.bindTools === 'function'
    ? llm.bindTools(lcTools)
    : llm;

  const response = await boundLLM.invoke([new SystemMessage(systemPrompt), ...callMessages]);
  newMessages.push(response);

  return {
    phase: 'ACT',
    strategy,
    messages: newMessages,
    phase_durations: { think: Date.now() - t0 },
  };
}

// ── Node: act ─────────────────────────────────────────────────────────────────
// Executes all tool calls requested by the last LLM response
export async function actNode(state) {
  const t0 = Date.now();
  const lastMessage = state.messages[state.messages.length - 1];
  const toolCalls = lastMessage?.tool_calls ?? [];

  const toolMessages = [];
  const stepResults = [];

  for (const tc of toolCalls) {
    let content;
    try {
      const result = await callTool(tc.name, tc.args ?? {}, { cycle_id: state.cycle_id });
      content = typeof result === 'string' ? result : JSON.stringify(result);
      stepResults.push({ tool: tc.name, inputs: tc.args, status: 'SUCCESS', outputs: result });
    } catch (err) {
      content = JSON.stringify({ error: err.message, ...(err.toolError ?? {}) });
      stepResults.push({ tool: tc.name, inputs: tc.args, status: 'FAILED', error: err.message });
    }

    toolMessages.push(
      new ToolMessage({ content, tool_call_id: tc.id, name: tc.name })
    );
  }

  return {
    phase: 'THINK',
    messages: toolMessages,
    results: stepResults,
    tool_call_count: state.tool_call_count + toolCalls.length,
    phase_durations: { act: Date.now() - t0 },
  };
}

// ── Node: consolidate ─────────────────────────────────────────────────────────
// Updates memory layers and fires post_run hook
export async function consolidateNode(state) {
  const t0 = Date.now();

  // Persist conversation to short-term sliding window
  const serialized = serializeMessages(state.messages);
  const updated_short_term = consolidateShortTerm(state.short_term, serialized);

  // Append cycle summary to episodic log
  const episodic_entry = buildEpisodicEntry(state, {
    type: 'cycle_complete',
    task: typeof state.task === 'string' ? state.task.slice(0, 120) : null,
    status: state.status,
    tool_calls_made: state.tool_call_count,
    results_count: state.results.length,
  });

  await hooks.fire('post_run', {
    cycle_id: state.cycle_id,
    iteration: state.iteration,
    tool_calls_made: state.tool_call_count,
    status: state.status,
  });

  return {
    phase: 'PERCEIVE',
    short_term: updated_short_term,
    episodic: episodic_entry,
    iteration: state.iteration + 1,
    tool_call_count: 0,
    messages: [],          // reset conversation for next cycle
    observations: [],
    phase_durations: { consolidate: Date.now() - t0 },
  };
}
