import { getStableFeatureCallbacks } from './portal-bridge';

export interface FeatureCallbackSlot {
  feature: string;
  path: string[];
  current: (...args: never[]) => unknown;
  refresh?: () => boolean;
}

const callbackRefresh = Symbol.for('@toolbox-web/grid-react:callback-refresh/v1');
type RefreshableCallback = { [callbackRefresh]?: (refresh: NonNullable<FeatureCallbackSlot['refresh']>) => void };

export function registerCallbackRefresh(callback: object, refresh: NonNullable<FeatureCallbackSlot['refresh']>): void {
  (callback as RefreshableCallback)[callbackRefresh]?.(refresh);
}

const refTokens = new WeakMap<object, number>();
let nextRefToken = 0;

export function getRefToken(value: object): number {
  let id = refTokens.get(value);
  if (id === undefined) {
    id = ++nextRefToken;
    refTokens.set(value, id);
  }
  return id;
}

export function matchesCallbackPath(path: string[], patterns: ReadonlyArray<readonly string[]>): boolean {
  return patterns.some(
    (pattern) =>
      pattern.length === path.length &&
      pattern.every((part, index) => part === path[index] || (part === '*' && /^\d+$/.test(path[index]))),
  );
}

function addCallback(
  feature: string,
  path: string[],
  callback: object,
  stablePaths: Map<string, string[][]>,
  callbacks: Array<[string[], number]>,
): void {
  const stable = matchesCallbackPath(path, getStableFeatureCallbacks(feature));
  if (stable) {
    const featurePaths = stablePaths.get(feature) ?? [];
    featurePaths.push(path);
    stablePaths.set(feature, featurePaths);
  }
  callbacks.push([path, stable ? 0 : getRefToken(callback)]);
}

function isUnvisitedObject(value: unknown, ancestors: WeakSet<object>): value is object {
  return typeof value === 'object' && value !== null && !ancestors.has(value);
}

export function collectFeatureCallbacks(
  value: unknown,
  feature: string,
  stablePaths: Map<string, string[][]>,
  callbacks: Array<[string[], number]>,
  path: string[] = [],
  ancestors = new WeakSet<object>(),
): void {
  if (typeof value === 'function') {
    addCallback(feature, path, value, stablePaths, callbacks);
    return;
  }
  if (!isUnvisitedObject(value, ancestors)) return;
  ancestors.add(value);
  for (const property of Object.keys(value)) {
    if (property === 'toJSON') continue;
    collectFeatureCallbacks(
      Reflect.get(value, property),
      feature,
      stablePaths,
      callbacks,
      [...path, property],
      ancestors,
    );
  }
  ancestors.delete(value);
}

export function wrapFeatureCallback(
  value: unknown,
  feature: string,
  path: string[],
  slots: FeatureCallbackSlot[],
  depth = 0,
): unknown {
  if (depth === path.length) {
    if (typeof value !== 'function') return value;
    const slot: FeatureCallbackSlot = { feature, path, current: value as (...args: never[]) => unknown };
    slots.push(slot);
    return Object.assign((...args: never[]) => slot.current(...args), {
      [callbackRefresh]: (refresh: NonNullable<FeatureCallbackSlot['refresh']>) => {
        slot.refresh = refresh;
      },
    });
  }
  if (Array.isArray(value)) {
    const copy = value.slice();
    const index = Number(path[depth]);
    copy[index] = wrapFeatureCallback(copy[index], feature, path, slots, depth + 1);
    return copy;
  }
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, unknown> = { ...value };
    const property = path[depth];
    copy[property] = wrapFeatureCallback(copy[property], feature, path, slots, depth + 1);
    return copy;
  }
  return value;
}

function resolveCallback(slot: FeatureCallbackSlot, props: Record<string, unknown>): unknown {
  let callback = props[slot.feature];
  for (const property of slot.path) {
    if (typeof callback !== 'object' || callback === null) break;
    callback = Reflect.get(callback, property);
  }
  return callback;
}

export function updateFeatureCallbackSlots(slots: FeatureCallbackSlot[], props: Record<string, unknown>): boolean {
  let afterRender = false;
  for (const slot of slots) {
    const callback = resolveCallback(slot, props);
    if (typeof callback === 'function' && callback !== slot.current) {
      slot.current = callback as (...args: never[]) => unknown;
      if (slot.refresh ? slot.refresh() : true) afterRender = true;
    }
  }
  return afterRender;
}
