import type { Frame, HostNode } from './core/tree';

/** The fields of a React fiber this walker reads. Internal React API: may change between versions. */
export interface Fiber {
  tag: number;
  type: unknown;
  memoizedProps: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  stateNode: unknown;
}

const HOST_COMPONENT = 5;
const HOST_TEXT = 6;

/** Converts the host components under `fiber` (and its siblings) into a test-renderer-style tree. */
export function fiberToTree(fiber: Fiber | null): (HostNode | string)[] {
  const out: (HostNode | string)[] = [];
  for (let f = fiber; f; f = f.sibling) {
    if (f.tag === HOST_COMPONENT) {
      const props = (f.memoizedProps ?? {}) as Record<string, unknown>;
      const children = fiberToTree(f.child);
      // Renderers like react-dom inline a lone text child as a prop instead of a text fiber.
      const inline = props.children;
      if (!children.length && (typeof inline === 'string' || typeof inline === 'number')) {
        children.push(String(inline));
      }
      out.push({
        type: String(f.type),
        props,
        children: children.length ? children : null,
        instance: f.stateNode,
      });
    } else if (f.tag === HOST_TEXT) {
      out.push(String(f.memoizedProps));
    } else {
      out.push(...fiberToTree(f.child));
    }
  }
  return out;
}

type DevToolsHook = {
  renderers?: Map<number, unknown>;
  getFiberRoots?: (rendererId: number) => Set<{ current: Fiber }>;
};

/** Every mounted React root, found through the DevTools hook React Native installs in dev builds. */
export function readRoots(): HostNode[] {
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook?.renderers || !hook.getFiberRoots) return [];
  const nodes: HostNode[] = [];
  for (const id of hook.renderers.keys()) {
    for (const root of hook.getFiberRoots(id)) {
      for (const node of fiberToTree(root.current.child)) {
        if (typeof node !== 'string') nodes.push(node);
      }
    }
  }
  return nodes;
}

type Measurable = {
  measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void;
};

/** Window frame of a host instance (New Architecture shapes first), or undefined. */
export function measure(instance: unknown): Promise<Frame | undefined> {
  const s = instance as { canonical?: { publicInstance?: Measurable } & Measurable } & Measurable;
  const target = [s?.canonical?.publicInstance, s?.canonical, s].find(
    (c): c is Required<Measurable> => typeof c?.measureInWindow === 'function',
  );
  if (!target) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    try {
      target.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(undefined);
    }
  });
}
