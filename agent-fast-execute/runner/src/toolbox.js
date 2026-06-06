import { hooks } from './hooks.js';

export const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  TOOL_ERROR: 'TOOL_ERROR',
};

// Retryable error codes per executor contract
const RETRYABLE = new Set([ERROR_CODES.TIMEOUT, ERROR_CODES.RATE_LIMIT]);

const registry = new Map();

// Pre-register a tool schema from toolbox.md (no execute required yet)
export function registerToolSchema(definition) {
  if (!definition.name) throw new Error('Tool schema requires a name.');
  const existing = registry.get(definition.name) ?? {};
  registry.set(definition.name, {
    timeout: 30_000,
    requires_confirmation: false,
    inputs: { type: 'object', properties: {}, required: [] },
    ...existing,
    ...definition,
    execute: existing.execute ?? (async () => {
      throw new Error(`Tool '${definition.name}': no execute function registered.`);
    }),
  });
}

// Register a tool with an execute function; merges with any pre-loaded schema
export function registerTool(definition) {
  if (!definition.name) throw new Error('Tool registration requires a name.');
  if (typeof definition.execute !== 'function') throw new Error(`Tool '${definition.name}' requires an execute function.`);

  const existing = registry.get(definition.name) ?? {};
  registry.set(definition.name, {
    timeout: 30_000,
    requires_confirmation: false,
    inputs: { type: 'object', properties: {}, required: [] },
    ...existing,   // schema pre-loaded from toolbox.md
    ...definition, // execute + any overrides
  });
}

export function getTool(name) {
  const tool = registry.get(name);
  if (!tool) throw createToolError(ERROR_CODES.NOT_FOUND, `Tool '${name}' is not registered.`, false);
  return tool;
}

export function listTools() {
  return Array.from(registry.values()).map(({ name, description, inputs, timeout, requires_confirmation }) => ({
    name,
    description,
    inputs,
    timeout,
    requires_confirmation,
  }));
}

// Convert registry entries to LangChain-compatible tool schemas for LLM binding
export function toLangChainTools() {
  return listTools().map(({ name, description, inputs }) => ({
    name,
    description: description ?? '',
    parameters: inputs,
  }));
}

export async function callTool(name, args, context = {}) {
  const tool = getTool(name);

  await hooks.fire('on_tool_call', { tool: name, inputs: args, context });

  const start = Date.now();
  let result = null;
  let error = null;

  try {
    result = await Promise.race([
      tool.execute(args, context),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(createToolError(ERROR_CODES.TIMEOUT, `Tool '${name}' timed out after ${tool.timeout}ms`, true)),
          tool.timeout
        )
      ),
    ]);
  } catch (err) {
    error = err.toolError ? err : createToolError(ERROR_CODES.TOOL_ERROR, err.message, false);
  }

  const duration_ms = Date.now() - start;

  await hooks.fire('on_tool_result', { tool: name, inputs: args, result, error: error?.message, duration_ms, context });

  if (error) throw error;
  return result;
}

export function createToolError(error_code, message, retryable = false) {
  const err = new Error(message);
  err.toolError = { error_code, message, retryable: retryable || RETRYABLE.has(error_code) };
  return err;
}

export { registry };
