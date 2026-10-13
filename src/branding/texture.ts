import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { renderLogoSVG } from './render';
import type { LogoSpec } from './types';

/** Rasterise an SVG string to a canvas (browser only). Fonts must already be loaded for exact text metrics. */
export async function svgToCanvas(svg: string, width: number, height = width): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = 'async';
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const s = Math.min(width / img.naturalWidth, height / img.naturalHeight) || 1;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

/** Create a THREE.CanvasTexture from a logo (for terminal signage, tail fins, ground markings). */
export async function createLogoTexture(spec: LogoSpec, size = 512): Promise<THREE.CanvasTexture> {
  const canvas = await svgToCanvas(renderLogoSVG(spec), size, spec.layout === 'side' ? Math.round(size / 3) : size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * React hook: returns a texture that re-renders when the logo changes. The returned
 * texture object is stable, so materials keep their reference; it is disposed on unmount.
 */
export function useLogoTexture(spec: LogoSpec | null, size = 512): THREE.CanvasTexture {
  const tex = useMemo(() => { const c = document.createElement('canvas'); c.width = c.height = size; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }, [size]);
  const svg = spec ? renderLogoSVG(spec) : '';
  useEffect(() => {
    if (!svg) return;
    let alive = true;
    svgToCanvas(svg, size, spec?.layout === 'side' ? Math.round(size / 3) : size).then((c) => {
      if (!alive) return;
      tex.image = c; tex.needsUpdate = true;
    }).catch(() => { /* keep previous image */ });
    return () => { alive = false; };
  }, [svg, size, tex, spec?.layout]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}
