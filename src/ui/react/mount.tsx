import { createRoot } from 'react-dom/client';
import type { UiActions, PriceList } from '../actions.js';
import type { UiStore } from '../store.js';
import { App } from './App.js';

export function mountReact(root: HTMLElement, store: UiStore, actions: UiActions, prices: PriceList): () => void {
  const r = createRoot(root);
  r.render(<App store={store} actions={actions} prices={prices} />);
  return () => r.unmount();
}
