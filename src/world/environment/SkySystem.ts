import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

const SKY_VERTEX_SOURCE = /* glsl */ `
precision highp float;

attribute vec3 position;

uniform mat4 worldViewProjection;

varying vec3 vDirection;

void main() {
  vDirection = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SOURCE = /* glsl */ `
precision highp float;

varying vec3 vDirection;

uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDir;   // direction the light travels (from sun toward scene)
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform vec3 uMoonDir;  // direction moonlight travels
uniform float uNight;   // 0 = day, 1 = deep night
uniform float uTime;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vDirection);

  // Vertical gradient from horizon to zenith.
  float t = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uHorizonColor, uZenithColor, pow(t, 0.5));

  // Sun disc plus a soft halo.
  vec3 toSun = normalize(-uSunDir);
  float d = max(dot(dir, toSun), 0.0);
  color += uSunColor * (pow(d, 600.0) * 1.4 + pow(d, 6.0) * 0.18);

  // Night sky: procedural star field (cellular hash — sparse, cheap)
  // and a pale moon disc with a soft glow, both fading in with uNight.
  if (uNight > 0.01) {
    vec2 grid = vec2(atan(dir.z, dir.x) * 4.0, dir.y * 9.0);
    vec2 cell = floor(grid * 6.0);
    vec2 f = fract(grid * 6.0);
    float h = hash21(cell);
    vec2 starPos = vec2(h, hash21(cell + 17.3)) * 0.7 + 0.15;
    float star = 1.0 - smoothstep(0.02, 0.07, length(f - starPos));
    float present = step(0.72, hash21(cell + 5.1)); // ~28% of cells
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.5 + h * 44.0);
    color += vec3(0.85, 0.9, 1.0) * 1.15 * star * present * twinkle * uNight
           * smoothstep(0.02, 0.1, dir.y);

    vec3 toMoon = normalize(-uMoonDir);
    float m = max(dot(dir, toMoon), 0.0);
    color += vec3(0.8, 0.86, 0.95) * (pow(m, 900.0) * 1.1 + pow(m, 12.0) * 0.1) * uNight;
  }

  // Converge to the scene fog color at and below the horizon — applied
  // last so it exactly matches the fully fogged ocean and the plane
  // edge disappears.
  float fogBand = 1.0 - smoothstep(0.0, 0.14, dir.y);
  color = mix(color, uFogColor, fogBand);

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Gradient sky dome.
 *
 * An inward-facing sphere with a two-color gradient shader plus a sun
 * disc — no textures or cube maps to download, and a single cheap draw
 * call. The dome follows the camera (`infiniteDistance`) so it always
 * fills the background; `EnvironmentSystem` feeds it the palette for
 * the current time of day.
 */
export class SkySystem {
  private material: ShaderMaterial | null = null;

  build(scene: Scene): Mesh {
    const mesh = CreateSphere(
      'sky',
      { diameter: 1000, segments: 16, sideOrientation: Mesh.BACKSIDE },
      scene,
    );
    mesh.infiniteDistance = true;
    mesh.isPickable = false;

    const material = new ShaderMaterial(
      'sky-mat',
      scene,
      { vertexSource: SKY_VERTEX_SOURCE, fragmentSource: SKY_FRAGMENT_SOURCE },
      {
        attributes: ['position'],
        uniforms: [
          'worldViewProjection',
          'uZenithColor',
          'uHorizonColor',
          'uSunDir',
          'uSunColor',
          'uFogColor',
          'uMoonDir',
          'uNight',
          'uTime',
        ],
      },
    );
    material.backFaceCulling = false;
    material.disableDepthWrite = true;

    mesh.material = material;
    this.material = material;
    return mesh;
  }

  /** Called by EnvironmentSystem whenever the palette changes. */
  setAtmosphere(
    zenith: Color3,
    horizon: Color3,
    sunDirection: Vector3,
    sunColor: Color3,
    fogColor: Color3,
    moonDirection: Vector3,
    nightFactor: number,
    timeSeconds: number,
  ): void {
    if (!this.material) {
      return;
    }
    this.material.setColor3('uZenithColor', zenith);
    this.material.setColor3('uHorizonColor', horizon);
    this.material.setVector3('uSunDir', sunDirection);
    this.material.setColor3('uSunColor', sunColor);
    this.material.setColor3('uFogColor', fogColor);
    this.material.setVector3('uMoonDir', moonDirection);
    this.material.setFloat('uNight', nightFactor);
    this.material.setFloat('uTime', timeSeconds);
  }

  dispose(): void {
    this.material = null;
  }
}
