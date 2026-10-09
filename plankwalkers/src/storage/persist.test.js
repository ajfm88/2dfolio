import { describe, expect, it, vi } from 'vitest';

import { createPersistRequest } from './persist.js';

describe('createPersistRequest', () => {
  it('returns null when the manager is missing', async () => {
    const persistence = createPersistRequest(() => undefined);
    expect(await persistence.request()).toBe(null);
  });

  it('returns null when getManager throws', async () => {
    const persistence = createPersistRequest(() => {
      throw new Error('denied');
    });
    expect(await persistence.request()).toBe(null);
  });

  it('returns true without calling persist when storage is already kept', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const persistence = createPersistRequest(() => ({
      persisted: () => Promise.resolve(true),
      persist,
    }));
    expect(await persistence.request()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns false when the browser declines', async () => {
    const persistence = createPersistRequest(() => ({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    }));
    expect(await persistence.request()).toBe(false);
  });

  it('asks the manager only once per page session', async () => {
    const persisted = vi.fn(() => Promise.resolve(false));
    const persist = vi.fn(() => Promise.resolve(true));
    const getManager = vi.fn(() => ({ persisted, persist }));
    const persistence = createPersistRequest(getManager);
    expect(await persistence.request()).toBe(true);
    expect(await persistence.request()).toBe(null);
    expect(getManager).toHaveBeenCalledTimes(1);
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('returns null when persist rejects', async () => {
    const persistence = createPersistRequest(() => ({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.reject(new Error('no')),
    }));
    expect(await persistence.request()).toBe(null);
  });
});
