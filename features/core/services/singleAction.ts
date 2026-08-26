export type SingleActionLock = {
  acquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
};

/**
 * Synchronous in-memory guard for UI actions. It closes the race window where
 * two taps arrive before a component's `busy` state has re-rendered.
 */
export function createSingleActionLock(): SingleActionLock {
  let locked = false;
  return {
    acquire: () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    release: () => {
      locked = false;
    },
    isLocked: () => locked,
  };
}
