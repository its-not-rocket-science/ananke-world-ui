import { writable } from 'svelte/store';
import { createDefaultState, type AppState } from '$lib/models';

function createAppStateStore() {
  const { subscribe, set, update } = writable<AppState>(createDefaultState());

  return {
    subscribe,
    set,
    update,
    reset: () => set(createDefaultState()),
  };
}

export const appState = createAppStateStore();
