import { WeatherParticles } from './particles';
import { WeatherCover } from './cover';

export class WeatherLayer {
  readonly particles = new WeatherParticles();
  readonly cover = new WeatherCover();

  get group() {
    return this.particles.group;
  }

  updateParticles(dt: number, precipType: 'none' | 'snow' | 'freezing_rain' | 'rain', weather: string, amount: number, fx: number, fz: number) {
    this.particles.updateParticles(dt, precipType, weather, amount, fx, fz);
  }

  dispose() {
    this.particles.dispose();
  }
}
