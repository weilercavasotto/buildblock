import * as THREE from 'three';
import { COLORS, SKY, hexToNumber } from '../constants';

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uHorizon, uZenith, uCloud, uCloudShade;
  uniform float uTime, uScale, uClump, uCoverage, uEvolve, uFadeStart, uFadeEnd, uGradientPower;
  uniform float uSeamWidth, uSeamStrength, uBevelWidth, uBevelStrength, uMinCellPixels;
  uniform vec2 uWind;
  varying vec3 vDir;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.0, 9.0);
      a *= 0.5;
    }
    return v;
  }

  // Cloud density at a point of the (continuous) cloud layer, in cell units.
  float density(vec2 p) {
    return fbm(p * uClump + uTime * uEvolve);
  }

  // A whole cell is either filled or empty: density is sampled at the cell centre.
  float filled(vec2 cell) {
    return step(uCoverage, density(cell + 0.5));
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), uGradientPower));

    // Project the view direction on a flat cloud layer. The wind moves the cell grid with the layer,
    // so block edges glide smoothly instead of the pattern snapping from cell to cell.
    vec2 p = d.xz / (d.y + 0.12) * uScale + uWind * uTime;
    vec2 cell = floor(p);
    vec2 f = fract(p);

    float blocky = filled(cell);
    vec3 cloudColor = uCloud;

    // Shaded bevel on the lower-right edges of a block (where the neighbouring cell is empty) and thin seams.
    float shadeX = step(1.0 - uBevelWidth, f.x) * (1.0 - filled(cell + vec2(1.0, 0.0)));
    float shadeY = step(1.0 - uBevelWidth, f.y) * (1.0 - filled(cell + vec2(0.0, 1.0)));
    cloudColor = mix(cloudColor, uCloudShade, max(shadeX, shadeY) * uBevelStrength);
    vec2 edge = min(f, 1.0 - f);
    float seam = 1.0 - step(uSeamWidth, min(edge.x, edge.y));
    cloudColor = mix(cloudColor, uCloudShade, seam * uSeamStrength);

    // Far away the cells get smaller than a few pixels: blend to the smooth density to avoid shimmering.
    float cellPixels = 1.0 / max(max(fwidth(p.x), fwidth(p.y)), 1e-5);
    float detail = smoothstep(uMinCellPixels * 0.5, uMinCellPixels, cellPixels);
    float smoothMask = smoothstep(uCoverage - 0.04, uCoverage + 0.04, density(p));
    float cloud = mix(smoothMask, blocky, detail);
    cloudColor = mix(uCloud, cloudColor, detail);

    float fade = smoothstep(uFadeStart, uFadeEnd, d.y);
    gl_FragColor = vec4(mix(sky, cloudColor, cloud * fade), 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Sky dome with a colour gradient and blocky procedural clouds drifting with the wind. */
export class Sky {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const color = (hex: string) => new THREE.Color(hexToNumber(hex));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: color(COLORS.scene.sky) },
        uZenith: { value: color(COLORS.scene.skyZenith) },
        uCloud: { value: color(COLORS.scene.cloud) },
        uCloudShade: { value: color(COLORS.scene.cloudShade) },
        uTime: { value: 0 },
        uScale: { value: SKY.cloudScale },
        uClump: { value: SKY.clumpiness },
        uWind: { value: new THREE.Vector2(...SKY.wind) },
        uCoverage: { value: SKY.coverage },
        uEvolve: { value: SKY.evolveSpeed },
        uFadeStart: { value: SKY.fadeStart },
        uFadeEnd: { value: SKY.fadeEnd },
        uGradientPower: { value: SKY.gradientPower },
        uSeamWidth: { value: SKY.seamWidth },
        uSeamStrength: { value: SKY.seamStrength },
        uBevelWidth: { value: SKY.bevelWidth },
        uBevelStrength: { value: SKY.bevelStrength },
        uMinCellPixels: { value: SKY.minCellPixels },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY.domeRadius, 32, 16), this.material);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
  }

  /** Call every frame: advances the clouds and keeps the dome centred on the camera. */
  update(elapsedSeconds: number, cameraPosition: THREE.Vector3): void {
    this.material.uniforms.uTime.value = elapsedSeconds;
    this.mesh.position.copy(cameraPosition);
  }
}
