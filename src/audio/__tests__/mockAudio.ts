/* Minimal AudioContext mock recording graph calls. */
export class MockParam {
  value = 1; events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.value = v; this.events.push(['set', v, t]); return this; }
  setTargetAtTime(v: number, t: number) { this.value = v; this.events.push(['target', v, t]); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.value = v; this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.value = v; this.events.push(['exp', v, t]); return this; }
  cancelScheduledValues() { return this; }
}
class MockNode {
  connections: unknown[] = [];
  connect<T>(n: T): T { this.connections.push(n); return n; }
  disconnect() {}
}
class MockGain extends MockNode { gain = new MockParam(); }
class MockSource extends MockNode {
  started = false; stoppedAt: number | null = null; frequency = new MockParam(); detune = new MockParam(); playbackRate = new MockParam();
  type = 'sine'; buffer: unknown = null; loop = false;
  start() { this.started = true; } stop(t = 0) { this.stoppedAt = t; }
}
class MockFilter extends MockNode { type = 'lowpass'; frequency = new MockParam(); Q = new MockParam(); }
class MockPanner extends MockNode { pan = new MockParam(); }
export class MockAudioContext {
  currentTime = 0; sampleRate = 8000; state: 'running' | 'suspended' | 'closed' = 'running';
  destination = new MockNode(); gains: MockGain[] = []; sources: MockSource[] = []; panners: MockPanner[] = [];
  createGain() { const g = new MockGain(); this.gains.push(g); return g; }
  createOscillator() { const s = new MockSource(); this.sources.push(s); return s; }
  createBufferSource() { const s = new MockSource(); this.sources.push(s); return s; }
  filters: MockFilter[] = [];
  createBiquadFilter() { const f = new MockFilter(); this.filters.push(f); return f; }
  createStereoPanner() { const p = new MockPanner(); this.panners.push(p); return p; }
  createBuffer(_c: number, len: number) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  async suspend() { this.state = 'suspended'; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  async decodeAudioData(raw: ArrayBuffer) {
    const bytes = new Uint8Array(raw);
    if (bytes.length < 4 || bytes[0] === 0x3c) throw new Error('decode');
    return { duration: 0.25, numberOfChannels: 1, sampleRate: 8000, length: 8, getChannelData: () => new Float32Array(8) };
  }
}
export class MockVisibility {
  hidden = false; private cbs = new Set<() => void>();
  addEventListener(_t: string, cb: () => void) { this.cbs.add(cb); }
  removeEventListener(_t: string, cb: () => void) { this.cbs.delete(cb); }
  set(h: boolean) { this.hidden = h; this.cbs.forEach((c) => c()); }
}
