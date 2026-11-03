import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './destny-store.config.js';

type StoreConfig = typeof config;
const context = new AsyncLocalStorage<StoreConfig>();
// Each interaction keeps its own immutable configuration across async REST calls.
export const activeConfig: StoreConfig = new Proxy(config, {
  get(target, key) { return Reflect.get(context.getStore() ?? target, key); },
});
export function withConfiguration<T>(value: StoreConfig, task: () => T): T {
  return context.run(value, task);
}
