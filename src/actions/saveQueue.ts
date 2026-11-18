/**
 * Serial saves per key (the asset id).
 *
 * The app saves the whole asset after every edit. If two saves were in flight together, a slow earlier request could be
 * applied after a later one and put the older values back. Here a key's saves run one after another, and each one reads
 * the latest state when it starts, so edits made while a save is waiting ride along with it (they do not queue extra requests).
 */
export function createSaveQueue(send: (key: string) => Promise<unknown>, onError: (error: unknown) => void) {
  const slots = new Map<string, { tail: Promise<void>; waiting: boolean; ok: boolean }>();
  let active = 0;
  return {
    /** Ask for a save. Returns false when one is already waiting to start: it will send the latest state anyway. */
    request(key: string): boolean {
      const slot = slots.get(key) ?? { tail: Promise.resolve(), waiting: false, ok: true };
      slots.set(key, slot);
      if (slot.waiting) return false;
      slot.waiting = true;
      active++;
      slot.tail = slot.tail
        .then(() => { slot.waiting = false; return send(key); })
        .then(() => { slot.ok = true; }, e => { slot.ok = false; onError(e); })
        .finally(() => { active--; });
      return true;
    },
    /** Resolves when every save asked for so far has finished: true if the last one succeeded. */
    settled(key: string): Promise<boolean> {
      const slot = slots.get(key);
      return slot ? slot.tail.then(() => slot.ok) : Promise.resolve(true);
    },
    /** Saves waiting or running. */
    get active() { return active; }
  };
}
