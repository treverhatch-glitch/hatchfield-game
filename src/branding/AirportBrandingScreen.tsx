import { useMemo, useState, type ReactNode } from 'react';
import { FONTS, ICONS, LAYOUTS, PALETTES, SHAPES, SHAPE_PATHS } from './parts';
import { PRESETS, applyPreset } from './presets';
import { randomizeLogo } from './random';
import { renderLogoSVG } from './render';
import type { BrandingSave, LogoColors, LogoSpec } from './types';
import { suggestCode, validateAirportName, validateCode } from './validate';

export interface AirportBrandingScreenProps {
  initial?: BrandingSave;
  onConfirm: (save: BrandingSave) => void;
  onCancel?: () => void;
  takenCodes?: string[]; // e.g. rival airport codes
}

const Svg = ({ svg, className = '' }: { svg: string; className?: string }) => (
  <span className={`block [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />
);

/** Cards lift and grow slightly on hover, settle back on leave (owner rule). */
const card = 'rounded-lg border border-white/10 bg-white/5 transition duration-150 ease-out hover:-translate-y-1 hover:scale-[1.04] hover:border-white/30 hover:bg-white/10 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400';
const sel = (on: boolean) => (on ? ' !border-sky-400 ring-1 ring-sky-400' : '');

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (<div className="mb-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</div><div className="flex flex-wrap gap-1.5">{children}</div></div>);
}

export function AirportBrandingScreen({ initial, onConfirm, onCancel, takenCodes = [] }: AirportBrandingScreenProps) {
  const [name, setName] = useState(initial?.airportName ?? 'Hatchfield');
  const [codeTouched, setCodeTouched] = useState(!!initial);
  const [codeInput, setCodeInput] = useState(initial?.code ?? suggestCode('Hatchfield', takenCodes));
  const code = codeTouched ? codeInput : suggestCode(name, takenCodes);
  const [tab, setTab] = useState<'presets' | 'customize'>('presets');
  const [presetId, setPresetId] = useState<string | undefined>(initial?.presetId ?? PRESETS[0].id);
  const [base, setBase] = useState<LogoSpec>(initial?.logo ?? PRESETS[0].spec);
  const spec: LogoSpec = { ...base, airportName: name.trim() || 'Hatchfield', code };

  const nameErr = validateAirportName(name);
  const codeErr = validateCode(code) ?? (takenCodes.includes(code) ? 'Code already used by another airport' : null);
  const preview = useMemo(() => renderLogoSVG(spec), [JSON.stringify(spec)]);
  const edit = (p: Partial<LogoSpec>) => { setPresetId(undefined); setBase((b) => ({ ...b, ...p })); };
  const setColor = (k: keyof LogoColors, v: string) => edit({ paletteId: 'custom', colors: { ...spec.colors, [k]: v } });

  return (
    <div className="pointer-events-auto mx-auto flex max-h-[86vh] w-[min(920px,94vw)] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/85 text-white shadow-2xl backdrop-blur-md">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <h2 className="text-sm font-bold tracking-wide">Name your airport</h2>
        <div className="ml-auto flex gap-1 text-xs">
          {(['presets', 'customize'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-2.5 py-1 capitalize ${tab === t ? 'bg-sky-500/80' : 'bg-white/5 hover:bg-white/10'}`}>{t}</button>
          ))}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <aside className="flex w-60 shrink-0 flex-col gap-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Airport name
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded bg-black/40 px-2 py-1.5 text-sm normal-case tracking-normal text-white outline-none ring-1 ring-white/10 focus:ring-sky-400" />
          </label>
          {nameErr && <p className="-mt-2 text-xs text-rose-300">{nameErr}</p>}
          <div className="flex items-end gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Code
              <input value={code} maxLength={3} onChange={(e) => { setCodeTouched(true); setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, '')); }} className="mt-1 w-20 rounded bg-black/40 px-2 py-1.5 font-mono text-sm tracking-widest text-white outline-none ring-1 ring-white/10 focus:ring-sky-400" />
            </label>
            {codeTouched && <button onClick={() => setCodeTouched(false)} className="mb-1 text-xs text-sky-300 hover:underline">Auto</button>}
            <label className="mb-1.5 ml-auto flex items-center gap-1 text-xs text-white/70"><input type="checkbox" checked={spec.showCode} onChange={(e) => edit({ showCode: e.target.checked })} /> Show</label>
          </div>
          {codeErr && <p className="-mt-2 text-xs text-rose-300">{codeErr}</p>}
          <div className="aspect-square w-full rounded-lg bg-[conic-gradient(#ffffff0d_25%,transparent_0_50%,#ffffff0d_0_75%,transparent_0)] bg-[length:16px_16px] p-3">
            <Svg svg={preview} className="h-full w-full" />
          </div>
          <button onClick={() => { setPresetId(undefined); setBase(randomizeLogo(spec)); }} className={`${card} px-3 py-1.5 text-xs`}>🎲 Randomize</button>
        </aside>
        <section className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'presets' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} title={`${p.label} (${p.style})`} onClick={() => { setPresetId(p.id); setBase(applyPreset(p, spec.airportName, code)); }} className={`${card} p-2 text-left${sel(presetId === p.id)}`}>
                  <Svg svg={renderLogoSVG(applyPreset(p, spec.airportName, code))} className="aspect-square w-full" />
                  <div className="mt-1 truncate text-[11px] text-white/80">{p.label}</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40">{p.style}</div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <Row label="Emblem">{SHAPES.map((s) => (
                <button key={s.id} title={s.label} onClick={() => edit({ shape: s.id })} className={`${card} h-11 w-11 p-1.5${sel(spec.shape === s.id)}`}>
                  {s.id === 'none' ? <span className="text-[10px] text-white/60">None</span> : <Svg svg={`<svg viewBox="0 0 100 100"><path d="${SHAPE_PATHS[s.id]}" fill="${spec.colors.primary}" fill-rule="evenodd" stroke="${spec.colors.secondary}" stroke-width="4"/></svg>`} className="h-full w-full" />}
                </button>))}</Row>
              <Row label="Icon">
                <button onClick={() => edit({ icon: 'none' })} className={`${card} h-10 w-10 text-[10px] text-white/60${sel(spec.icon === 'none')}`}>None</button>
                {Object.entries(ICONS).map(([id, ic]) => (
                  <button key={id} title={ic.label} onClick={() => edit({ icon: id })} className={`${card} h-10 w-10 p-1.5${sel(spec.icon === id)}`}>
                    <Svg svg={`<svg viewBox="0 0 100 100"><path d="${ic.d}" fill="#fff" fill-rule="evenodd"/></svg>`} className="h-full w-full" />
                  </button>))}
              </Row>
              <Row label="Palette">{PALETTES.map((pl) => (
                <button key={pl.id} title={pl.label} onClick={() => edit({ paletteId: pl.id, colors: { ...pl.colors } })} className={`${card} flex h-8 overflow-hidden !p-0${sel(spec.paletteId === pl.id)}`}>
                  {[pl.colors.primary, pl.colors.secondary, pl.colors.accent].map((c, i) => <span key={i} className="block h-full w-4" style={{ background: c }} />)}
                </button>))}</Row>
              <Row label="Custom colours">{(['primary', 'secondary', 'accent', 'text'] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-[11px] capitalize text-white/70"><input type="color" value={spec.colors[k]} onChange={(e) => setColor(k, e.target.value)} className="h-6 w-7 cursor-pointer rounded bg-transparent" />{k}</label>))}
                <label className="flex items-center gap-1 text-[11px] text-white/70"><input type="checkbox" checked={spec.colors.background !== 'transparent'} onChange={(e) => setColor('background', e.target.checked ? '#0f172a' : 'transparent')} />Background</label>
              </Row>
              <Row label="Font">{Object.entries(FONTS).map(([id, f]) => (
                <button key={id} onClick={() => edit({ font: id })} className={`${card} px-2.5 py-1 text-xs${sel(spec.font === id)}`} style={{ fontFamily: f.stack, fontWeight: f.weight, fontStyle: f.italic ? 'italic' : undefined }}>{f.label}</button>))}</Row>
              <Row label="Layout">{LAYOUTS.map((l) => (
                <button key={l.id} onClick={() => edit({ layout: l.id })} className={`${card} px-2.5 py-1 text-xs${sel(spec.layout === l.id)}`}>{l.label}</button>))}</Row>
              <Row label="Fine tune">
                <label className="flex items-center gap-2 text-[11px] text-white/70">Icon size<input type="range" min={0.5} max={1.4} step={0.05} value={spec.iconScale} onChange={(e) => edit({ iconScale: +e.target.value })} /></label>
                <label className="flex items-center gap-2 text-[11px] text-white/70">Outline<input type="range" min={0} max={8} step={1} value={spec.strokeWidth} onChange={(e) => edit({ strokeWidth: +e.target.value })} /></label>
              </Row>
            </div>
          )}
        </section>
      </div>
      <footer className="flex justify-end gap-2 border-t border-white/10 px-4 py-2.5">
        {onCancel && <button onClick={onCancel} className="rounded px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Back</button>}
        <button disabled={!!nameErr || !!codeErr} onClick={() => onConfirm({ airportName: spec.airportName, code, logo: spec, ...(presetId ? { presetId } : {}) })}
          className="rounded bg-sky-500 px-4 py-1.5 text-xs font-semibold hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40">Open airport</button>
      </footer>
    </div>
  );
}
