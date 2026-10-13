import { Fragment, useState } from 'react';
import type { AdvisorCard, CameraTarget } from './types';

const DOT: Record<AdvisorCard['severity'], string> = { critical: '#ef4444', warn: '#f59e0b', info: '#38bdf8' };

/** Small CS2-style stack. Sits in a gutter, never covers the play area; numbers behind a click. */
export function AdvisorCards(props: { cards: AdvisorCard[]; onShowMe: (t: CameraTarget) => void; onDismiss: (key: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (props.cards.length === 0) return null;
  return (
    <div data-testid="advisor-cards" style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 260, pointerEvents: 'auto' }}>
      {props.cards.map((c) => (
        <div key={c.key} data-testid={`advisor-card-${c.rule}`} style={{ background: 'rgba(17,24,39,.85)', color: '#e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[c.severity] }} />
            <b style={{ flex: 1 }}>{c.title}</b>
            <button aria-label="Dismiss" onClick={() => props.onDismiss(c.key)}>×</button>
          </div>
          <div>{c.body}</div>
          <div style={{ opacity: 0.85 }}>→ {c.fix}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {c.target && <button onClick={() => props.onShowMe(c.target!)}>Show me</button>}
            {c.details && <button onClick={() => setOpen(open === c.key ? null : c.key)}>Details</button>}
          </div>
          {open === c.key && c.details && (
            <dl style={{ margin: '4px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 8px' }}>
              {Object.entries(c.details).map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd style={{ margin: 0 }}>{String(v)}</dd></Fragment>))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}
