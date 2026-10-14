import * as THREE from 'three';

function rng(seed: number) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export class WeatherParticles {
  readonly group = new THREE.Group();

  // Rain
  private rainLines: THREE.LineSegments;
  private rainPos: Float32Array;
  private rainVel: Float32Array;
  private rainMat: THREE.LineBasicMaterial;
  private rainN: number;

  // Snow
  private snowMesh: THREE.InstancedMesh;
  private snowMat: THREE.MeshBasicMaterial;
  private snowN: number;
  private snowVel: Float32Array;

  // Fog / Wind Particles
  private fogMesh: THREE.InstancedMesh;
  private fogMat: THREE.MeshBasicMaterial;
  private fogN: number;
  private fogVel: Float32Array;

  constructor(maxParticles: number = 800) {
    const rand = rng(5);

    // --- Rain ---
    this.rainN = Math.max(1, maxParticles);
    this.rainPos = new Float32Array(this.rainN * 6);
    this.rainVel = new Float32Array(this.rainN);
    for (let i = 0; i < this.rainN; i++) {
      const x = (rand() - 0.5) * 80;
      const y = rand() * 40;
      const z = (rand() - 0.5) * 80;
      this.rainPos.set([x, y, z, x + 0.1, y + 0.9, z + 0.05], i * 6);
      this.rainVel[i] = 26 + rand() * 10;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.45, depthWrite: false });
    this.rainLines = new THREE.LineSegments(rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.rainLines.name = 'weather-rain';
    this.group.add(this.rainLines);

    // --- Snow ---
    this.snowN = maxParticles;
    const snowGeo = new THREE.PlaneGeometry(0.1, 0.1);
    this.snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    this.snowMesh = new THREE.InstancedMesh(snowGeo, this.snowMat, this.snowN);
    this.snowMesh.frustumCulled = false;
    this.snowMesh.visible = false;
    this.snowMesh.name = 'weather-snow';
    this.snowVel = new Float32Array(this.snowN * 2); // dx, dy
    const snowMatrix = new THREE.Matrix4();
    for (let i = 0; i < this.snowN; i++) {
      const x = (rand() - 0.5) * 60;
      const y = rand() * 30;
      const z = (rand() - 0.5) * 60;
      snowMatrix.makeTranslation(x, y, z);
      this.snowMesh.setMatrixAt(i, snowMatrix);
      this.snowVel[i * 2] = (rand() - 0.5) * 2; // dx
      this.snowVel[i * 2 + 1] = 2 + rand() * 3; // dy
    }
    this.group.add(this.snowMesh);

    // --- Fog/Wind ---
    this.fogN = Math.floor(maxParticles / 4);
    const fogGeo = new THREE.PlaneGeometry(2, 2);
    this.fogMat = new THREE.MeshBasicMaterial({ color: 0xd0d8e0, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide });
    this.fogMesh = new THREE.InstancedMesh(fogGeo, this.fogMat, this.fogN);
    this.fogMesh.frustumCulled = false;
    this.fogMesh.visible = false;
    this.fogMesh.name = 'weather-fog';
    this.fogVel = new Float32Array(this.fogN * 2); // dx, dy
    const fogMatrix = new THREE.Matrix4();
    for (let i = 0; i < this.fogN; i++) {
      const x = (rand() - 0.5) * 100;
      const y = rand() * 10;
      const z = (rand() - 0.5) * 100;
      fogMatrix.makeTranslation(x, y, z);
      this.fogMesh.setMatrixAt(i, fogMatrix);
      this.fogVel[i * 2] = 5 + rand() * 5; // wind dx
      this.fogVel[i * 2 + 1] = (rand() - 0.5) * 1; // drift dy
    }
    this.group.add(this.fogMesh);
  }

  updateParticles(dt: number, precipType: 'none' | 'snow' | 'freezing_rain' | 'rain', weather: string, amount: number, fx: number, fz: number) {
    this.rainLines.visible = false;
    this.snowMesh.visible = false;
    this.fogMesh.visible = false;

    if (amount <= 0.01 && weather !== 'fog' && weather !== 'storm') return;

    if (precipType === 'snow') {
      this.snowMesh.visible = true;
      this.snowMesh.position.set(fx, 0, fz);
      this.snowMat.opacity = 0.4 + amount * 0.4;
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      for (let i = 0; i < Math.floor(this.snowN * amount); i++) {
        this.snowMesh.getMatrixAt(i, matrix);
        pos.setFromMatrixPosition(matrix);
        pos.y -= this.snowVel[i * 2 + 1] * dt;
        pos.x -= this.snowVel[i * 2] * dt;
        if (pos.y < 0) pos.y += 30;
        if (pos.x < -30) pos.x += 60;
        if (pos.x > 30) pos.x -= 60;
        matrix.setPosition(pos);
        this.snowMesh.setMatrixAt(i, matrix);
      }
      this.snowMesh.instanceMatrix.needsUpdate = true;
      this.snowMesh.count = Math.floor(this.snowN * amount);
    } else if (precipType === 'rain' || precipType === 'freezing_rain') {
      this.rainLines.visible = true;
      this.rainMat.opacity = 0.25 + amount * 0.3;
      this.rainLines.position.set(fx, 0, fz);
      const p = this.rainPos;
      const draw = Math.floor(this.rainN * amount);
      for (let i = 0; i < draw; i++) {
        const o = i * 6;
        const dy = this.rainVel[i] * dt;
        p[o + 1] -= dy;
        p[o + 4] -= dy;
        if (p[o + 1] < 0) {
          p[o + 1] += 40;
          p[o + 4] += 40;
        }
      }
      this.rainLines.geometry.setDrawRange(0, draw * 2);
      (this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    if (weather === 'fog' || (weather === 'storm' && precipType !== 'snow')) {
      this.fogMesh.visible = true;
      this.fogMesh.position.set(fx, 0, fz);
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const drawFog = weather === 'fog' ? this.fogN : Math.floor(this.fogN * 0.5);
      this.fogMat.opacity = weather === 'fog' ? 0.2 : 0.1;
      for (let i = 0; i < drawFog; i++) {
        this.fogMesh.getMatrixAt(i, matrix);
        pos.setFromMatrixPosition(matrix);
        pos.x -= this.fogVel[i * 2] * dt;
        pos.y -= this.fogVel[i * 2 + 1] * dt;
        if (pos.x < -50) pos.x += 100;
        if (pos.y < 0) pos.y += 10;
        if (pos.y > 10) pos.y -= 10;
        matrix.setPosition(pos);
        this.fogMesh.setMatrixAt(i, matrix);
      }
      this.fogMesh.instanceMatrix.needsUpdate = true;
      this.fogMesh.count = drawFog;
    }
  }

  dispose() {
    this.rainLines.geometry.dispose();
    this.rainMat.dispose();
    this.snowMesh.geometry.dispose();
    this.snowMat.dispose();
    this.snowMesh.dispose();
    this.fogMesh.geometry.dispose();
    this.fogMat.dispose();
    this.fogMesh.dispose();
  }
}
