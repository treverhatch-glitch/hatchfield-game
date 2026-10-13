import { useMemo } from 'react';
import { certificateSVG, formatTicker, listingBadgeSVG, type CertificateData } from './finance';
import { renderLogoSVG } from './render';
import type { LogoSpec } from './types';

const Svg = ({ svg, className = '' }: { svg: string; className?: string }) => <span className={`block [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;

export interface StockTickerCardProps { spec: LogoSpec; ticker: string; price: number; change: number /* fraction, 0.012 = +1.2% */; history?: number[]; onClick?: () => void }

/** Compact quote card for the HATCH exchange panel. Lifts slightly on hover. */
export function StockTickerCard({ spec, ticker, price, change, history = [], onClick }: StockTickerCardProps) {
  const logo = useMemo(() => renderLogoSVG({ ...spec, layout: 'none' }), [spec]);
  const up = change >= 0;
  const spark = useMemo(() => {
    if (history.length < 2) return '';
    const lo = Math.min(...history), hi = Math.max(...history), span = hi - lo || 1;
    return history.map((v, i) => `${(i / (history.length - 1)) * 100},${30 - ((v - lo) / span) * 28 - 1}`).join(' ');
  }, [history]);
  return (
    <button type="button" onClick={onClick} className="flex w-56 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 p-2 text-left text-white backdrop-blur transition duration-150 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-white/30">
      <Svg svg={logo} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-bold">{formatTicker(ticker)}</div>
        <div className="truncate text-[10px] text-white/50">{spec.airportName}</div>
      </div>
      {spark && <svg viewBox="0 0 100 30" className="h-6 w-14"><polyline points={spark} fill="none" stroke={up ? '#34d399' : '#f87171'} strokeWidth="2" /></svg>}
      <div className="text-right font-mono">
        <div className="text-sm">{price.toFixed(2)}</div>
        <div className={`text-[10px] ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '▲' : '▼'} {(Math.abs(change) * 100).toFixed(1)}%</div>
      </div>
    </button>
  );
}

export function ShareCertificate(props: CertificateData & { className?: string }) {
  const { className = 'w-full max-w-xl', ...d } = props;
  const svg = useMemo(() => certificateSVG(d), [JSON.stringify(d)]);
  return <Svg svg={svg} className={`aspect-[800/520] ${className}`} />;
}

export function ExchangeListingBadge({ spec, ticker, className = 'h-8' }: { spec: LogoSpec; ticker: string; className?: string }) {
  const svg = useMemo(() => listingBadgeSVG(spec, ticker), [spec, ticker]);
  return <Svg svg={svg} className={`aspect-[240/64] ${className}`} />;
}
