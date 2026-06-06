import { callTool, createToolError, ERROR_CODES } from './toolbox.js';
import { hooks } from './hooks.js';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 2_000;
const STEP_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 300_000;

export const STEP_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRY: 'RETRY',
  EXHAUSTED: 'EXHAUSTED',
  ABORTED: 'ABORTED',
  SKIPPED: 'SKIPPED',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeStep(step, context, signal) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    if (signal.aborted) {
      return { ...step, status: STEP_STATUS.ABORTED, error: 'Execution aborted by total timeout' };
    }

    try {
      const result = await Promise.race([
        callTool(step.tool, step.inputs, context),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(createToolError(ERROR_CODES.TIMEOUT, `Step '${step.id}' exceeded ${STEP_TIMEOUT_MS}ms`, true)),
            STEP_TIMEOUT_MS
          )
        ),
      ]);

      return { ...step, status: STEP_STATUS.SUCCESS, outputs: result, attempts: attempt + 1 };
    } catch (err) {
      const retryable = err.toolError?.retryable ?? false;

      await hooks.fire('on_error', {
        step: step.id,
        tool: step.tool,
        attempt,
        error: err.message,
        retryable,
      });

      if (!retryable || attempt >= MAX_RETRIES) {
        const status = attempt >= MAX_RETRIES ? STEP_STATUS.EXHAUSTED : STEP_STATUS.FAILED;
        if (step.on_error === 'abort') {
          return { ...step, status: STEP_STATUS.ABORTED, error: err.message, attempts: attempt + 1 };
        }
        return { ...step, status, error: err.message, attempts: attempt + 1 };
      }

      // Exponential backoff: 2s → 4s → 8s
      await sleep(BACKOFF_BASE_MS * 2 ** attempt);
      attempt++;
    }
  }
}

// Execute a declarative plan produced by the planner (sequential, with dependency resolution)
export async function executePlan(plan, context = {}) {
  const started_at = Date.now();
  const stepOutputs = new Map();
  const stepStatuses = {};
  const controller = new AbortController();
  const results = [];

  const totalTimer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

  for (const step of plan.steps) {
    if (controller.signal.aborted) {
      results.push({ ...step, status: STEP_STATUS.ABORTED });
      continue;
    }

    // Skip steps whose dependencies did not succeed
    const blockedByDep = step.depends_on?.some(
      (id) => stepStatuses[id] && stepStatuses[id] !== STEP_STATUS.SUCCESS
    );

    if (blockedByDep) {
      results.push({ ...step, status: STEP_STATUS.SKIPPED, reason: 'Dependency did not succeed' });
      stepStatuses[step.id] = STEP_STATUS.SKIPPED;
      continue;
    }

    // Inject dependency outputs into context
    const stepContext = {
      ...context,
      step_outputs: Object.fromEntries(
        (step.depends_on ?? []).filter((id) => stepOutputs.has(id)).map((id) => [id, stepOutputs.get(id)])
      ),
    };

    const result = await executeStep(step, stepContext, controller.signal);
    stepOutputs.set(step.id, result.outputs);
    stepStatuses[step.id] = result.status;
    results.push(result);

    if (result.status === STEP_STATUS.ABORTED) controller.abort();
  }

  clearTimeout(totalTimer);

  const steps_succeeded = results.filter((r) => r.status === STEP_STATUS.SUCCESS).length;
  const steps_failed = results.filter((r) => [STEP_STATUS.FAILED, STEP_STATUS.EXHAUSTED, STEP_STATUS.ABORTED].includes(r.status)).length;

  return {
    task_id: plan.plan_id,
    status: steps_failed === 0 ? 'SUCCESS' : steps_succeeded === 0 ? 'FAILED' : 'PARTIAL',
    duration_ms: Date.now() - started_at,
    steps_total: plan.steps.length,
    steps_succeeded,
    steps_failed,
    results,
  };
}
