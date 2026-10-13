import { useMemo } from 'react';
import { renderLogoSVG } from './render';
import type { LogoSpec } from './types';

/** Small HUD badge: emblem + optional name, for the top status strip. */
export function LogoBadge({ spec, size = 28, showName = true, onClick }: { spec: LogoSpec; size?: number; showName?: boolean; onClick?: () => void }) {
  const svg = useMemo(() => renderLogoSVG({ ...spec, layout: 'none' }), [spec]);
  return (
    <button type="button" onClick={onClick} title={`${spec.airportName}${spec.code ? ` (${spec.code})` : ''}`}
      className="flex items-center gap-2 rounded-md bg-black/40 px-1.5 py-1 text-xs font-semibold text-white/90 backdrop-blur hover:bg-black/60">
      <span style={{ width: size, height: size }} className="block shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {showName && <span className="max-w-40 truncate">{spec.airportName}{spec.code ? <span className="ml-1 text-white/50">{spec.code}</span> : null}</span>}
    </button>
  );
}
