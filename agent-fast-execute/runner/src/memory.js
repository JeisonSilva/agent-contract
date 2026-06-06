import { hooks } from './hooks.js';

// Short-term: sliding window of last N messages (from loop context)
const SHORT_TERM_WINDOW_DEFAULT = 20;

// memoryConfig is the memory block from loadAgentConfig() (mirrors memory.md)
export function consolidateShortTerm(existing, newMessages, memoryConfig = {}) {
  const window = memoryConfig?.short_term_window ?? SHORT_TERM_WINDOW_DEFAULT;
  const merged = [...existing, ...newMessages];
  return merged.slice(-window);
}

export function recallShortTerm(state) {
  return state.short_term.slice(-SHORT_TERM_WINDOW);
}

// Working memory: key-value store scoped to current task
export function setWorking(state, key, value) {
  hooks.fire('on_memory_update', { layer: 'working', key, value, cycle_id: state.cycle_id });
  return { [key]: value };
}

export function getWorking(state, key) {
  return state.working[key];
}

// Episodic memory: append-only chronological event log
export function buildEpisodicEntry(state, entry) {
  const event = {
    timestamp: new Date().toISOString(),
    cycle_id: state.cycle_id,
    iteration: state.iteration,
    ...entry,
  };
  hooks.fire('on_memory_update', { layer: 'episodic', event, cycle_id: state.cycle_id });
  return [event];
}

export function recallEpisodic(state, { type, limit } = {}) {
  let events = state.episodic;
  if (type) events = events.filter((e) => e.type === type);
  if (limit) events = events.slice(-limit);
  return events;
}

// Serialize messages to storable format for short_term consolidation
export function serializeMessages(messages) {
  return messages.map((m) => ({
    role: m.getType?.() ?? m._getType?.() ?? 'unknown',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    timestamp: new Date().toISOString(),
    ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id, name: m.name } : {}),
  }));
}
