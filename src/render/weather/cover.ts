import * as THREE from 'three';

export class WeatherCover {
  private snowColor = new THREE.Color();
  private farmBase = 0xb8c8a8;
  private snowOn = false;

  paintSnow(
    snow: number,
    wet: number,
    quality: string,
    grass?: THREE.MeshLambertMaterial,
    farmMat?: THREE.MeshLambertMaterial,
    fieldMat?: THREE.MeshLambertMaterial,
    tuftMat?: THREE.MeshLambertMaterial
  ) {
    if (snow <= 0) {
      if (!this.snowOn) return;
      this.snowOn = false;
      if (farmMat) {
        farmMat.color.setHex(this.farmBase);
        farmMat.emissive.setHex(0x000000);
        farmMat.emissiveIntensity = 0;
      }
      if (fieldMat) {
        fieldMat.color.setHex(0xffffff);
        fieldMat.emissive.setHex(0x000000);
        fieldMat.emissiveIntensity = 0;
      }
      if (tuftMat && quality !== 'low') {
        tuftMat.color.setHex(0x8ab85a); // Back to tip color roughly, or let it reset by WorldRender
        tuftMat.emissive.setHex(0x000000);
        tuftMat.emissiveIntensity = 0;
      }
      return;
    }

    this.snowOn = true;
    const wash = 1 - wet * 0.28;
    this.snowColor.setHex(0xe7eef2);

    if (grass) {
      grass.color.lerp(this.snowColor, snow);
      grass.emissive.setHex(0xe4eef4);
      grass.emissiveIntensity = 0.7 * snow * wash;
    }
    if (farmMat) {
      farmMat.color.setHex(this.farmBase);
      farmMat.color.lerp(this.snowColor, snow);
      farmMat.emissive.setHex(0xdfe7ee);
      farmMat.emissiveIntensity = 0.55 * snow * wash;
    }
    if (fieldMat) {
      fieldMat.color.setHex(0xf4f7f8);
      fieldMat.emissive.setHex(0xe7eef3);
      fieldMat.emissiveIntensity = 0.62 * snow * wash;
    }
    if (tuftMat && quality !== 'low') {
      tuftMat.color.setHex(0xe7eef2);
      tuftMat.emissive.setHex(0xf4f7fb);
      tuftMat.emissiveIntensity = 0.5 * snow;
    }
  }
}
