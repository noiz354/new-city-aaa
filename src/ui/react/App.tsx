import { useEffect, useSyncExternalStore, type JSX } from 'react';
import type { UiActions, PriceList } from '../actions.js';
import type { UiStore } from '../store.js';
import { Inspector } from './Inspector.js';
import { TopBar } from './TopBar.js';
import { Toolbar } from './Toolbar.js';

export function App({ store, actions, prices }: { store: UiStore; actions: UiActions; prices: PriceList }): JSX.Element {
  const s = useSyncExternalStore(store.subscribe, () => store.getState());

  useEffect(() => {
    if (!s.toast) return;
    const t = window.setTimeout(() => {
      if (store.getState().toast?.id === s.toast?.id) store.set({ toast: null });
    }, 3500);
    return () => window.clearTimeout(t);
  }, [s.toast, store]);

  return (
    <>
      <TopBar snapshot={s.snapshot} projection={s.projection} driver={s.storageDriver} actions={actions} valueOverlay={s.valueOverlay} />
      <Toolbar tool={s.tool} previewCost={s.previewCost} previewNote={s.previewNote} actions={actions} prices={prices} />
      <Inspector tile={s.selectedTile} world={store.world} actions={actions} />
      {s.toast && (
        <div className="toast panel" key={s.toast.id}>
          {s.toast.text}
        </div>
      )}
    </>
  );
}
