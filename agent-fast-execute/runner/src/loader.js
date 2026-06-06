import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Two levels up from runner/src/ → agent-fast-execute/
export const DEFAULT_CONTRACTS_DIR = resolve(__dirname, '../../');

function extractYamlBlocks(content) {
  const results = [];
  const re = /```yaml\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    try {
      const parsed = yaml.load(m[1]);
      if (parsed && typeof parsed === 'object') results.push(parsed);
    } catch { /* skip invalid YAML */ }
  }
  return results;
}

function isPlaceholder(val) {
  return typeof val === 'string' && /^<.*>$/.test(val.trim());
}

function safeVal(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (isPlaceholder(String(val))) return fallback;
  return val;
}

function parseDuration(val) {
  if (val === null || val === undefined || isPlaceholder(String(val ?? ''))) return null;
  if (typeof val === 'number') return val;
  const m = String(val).match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'ms' ? n : m[2] === 's' ? n * 1000 : m[2] === 'm' ? n * 60_000 : n * 3_600_000;
}

function convertToolInputs(inputs) {
  if (!inputs || typeof inputs !== 'object') {
    return { type: 'object', properties: {}, required: [] };
  }
  const properties = {};
  const required = [];
  for (const [key, def] of Object.entries(inputs)) {
    if (!def || isPlaceholder(String(def.type ?? ''))) continue;
    properties[key] = { type: def.type };
    if (def.description && !isPlaceholder(def.description)) {
      properties[key].description = def.description;
    }
    if (def.default !== undefined && !isPlaceholder(String(def.default))) {
      properties[key].default = def.default;
    }
    if (def.required === true) required.push(key);
  }
  return { type: 'object', properties, required };
}

function extractRulesText(content) {
  const lines = content.split('\n');
  const out = [];
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (!inCode) out.push(line);
  }
  const text = out.join('\n');
  const start = text.indexOf('## Rule Categories');
  return start >= 0 ? text.slice(start).trim() : '';
}

function readMd(dir, path) {
  return readFileSync(resolve(dir, path), 'utf-8');
}

export function loadAgentConfig(contractsDir = DEFAULT_CONTRACTS_DIR) {
  const read = (p) => readMd(contractsDir, p);

  const agentMd    = read('agent.md');
  const rulesMd    = read('rules.md');
  const memoryMd   = read('memory.md');
  const skillMd    = read('skill.md');
  const loopMd     = read('contracts/loop.md');
  const plannerMd  = read('contracts/planner.md');
  const executorMd = read('contracts/executor.md');
  const toolboxMd  = read('contracts/toolbox.md');

  const [identityBlock] = extractYamlBlocks(agentMd);
  const [loopBlock]     = extractYamlBlocks(loopMd);
  const [plannerBlock]  = extractYamlBlocks(plannerMd);
  const [executorBlock] = extractYamlBlocks(executorMd);
  const [memoryBlock]   = extractYamlBlocks(memoryMd);

  const skillBlocks = extractYamlBlocks(skillMd).filter(b => b?.skill && !isPlaceholder(b.skill));
  const toolBlocks  = extractYamlBlocks(toolboxMd).filter(b => b?.tool && !isPlaceholder(b.tool));

  const loop     = loopBlock?.loop ?? {};
  const planner  = plannerBlock?.planner ?? {};
  const executor = executorBlock?.executor ?? {};
  const memory   = memoryBlock?.memory ?? {};

  const tools = toolBlocks.map(b => ({
    name: b.tool,
    description: safeVal(b.description, ''),
    inputs: convertToolInputs(b.inputs),
    timeout: parseDuration(b.timeout) ?? 30_000,
    requires_confirmation: b.requires_confirmation ?? false,
  }));

  // Short-term window: max_entries takes priority, else derive from max_tokens
  const stConfig = memory.short_term ?? {};
  const shortTermWindow =
    safeVal(stConfig.max_entries) != null ? Number(stConfig.max_entries)
    : safeVal(stConfig.max_tokens) != null ? Math.max(5, Math.min(100, Math.floor(stConfig.max_tokens / 400)))
    : null;

  const maxIter = loop.max_iterations === null ? Infinity : safeVal(loop.max_iterations, 10);

  return {
    identity: identityBlock ?? {},
    loop: {
      mode:           safeVal(loop.mode, 'triggered'),
      max_iterations: maxIter,
      interval:       parseDuration(loop.interval),
      idle_behavior:  safeVal(loop.idle_behavior, 'wait'),
    },
    planner: {
      default_strategy:        safeVal(planner.default_strategy, 'react'),
      max_plan_steps:          safeVal(planner.max_plan_steps, 20),
      fallback_strategy:       safeVal(planner.fallback_strategy, 'chain_of_thought'),
      allow_dynamic_replanning: planner.allow_dynamic_replanning ?? true,
    },
    executor: {
      max_retries:       safeVal(executor.max_retries, 3),
      timeout_per_step:  parseDuration(executor.timeout_per_step) ?? 30_000,
      timeout_total:     parseDuration(executor.timeout_total) ?? 300_000,
      on_failure:        safeVal(executor.on_failure, 'stop_and_report'),
    },
    memory: {
      ...memory,
      short_term_window: shortTermWindow,
    },
    tools,
    skills: skillBlocks,
    rules: extractRulesText(rulesMd),
  };
}
