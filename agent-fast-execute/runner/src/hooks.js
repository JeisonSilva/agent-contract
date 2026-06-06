import { EventEmitter } from 'events';

const HOOK_TIMEOUT_MS = 200;

class HookSystem extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // Fire all listeners for an event and wait for them (non-blocking on error)
  async fire(event, payload) {
    const listeners = this.rawListeners(event);
    if (!listeners.length) return;

    const enriched = {
      hook: event,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    await Promise.allSettled(
      listeners.map((fn) =>
        Promise.race([
          Promise.resolve(fn(enriched)),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Hook '${event}' exceeded ${HOOK_TIMEOUT_MS}ms`)), HOOK_TIMEOUT_MS)
          ),
        ])
      )
    );
  }

  // Register a hook handler; returns an unregister function
  register(event, handler) {
    this.on(event, handler);
    return () => this.off(event, handler);
  }
}

export const hooks = new HookSystem();
