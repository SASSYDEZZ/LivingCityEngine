import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

import type { WorldConfig } from '../WorldConfig';

const WATER_VERTEX_SOURCE = /* glsl */ `
precision highp float;

attribute vec3 position;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform float uTime;

varying vec3 vWorldPos;
varying vec3 vNormal;

// Sum of three drifting sine waves. Cheap, tileless, runs entirely on
// the GPU — no per-frame vertex uploads from the CPU.
float waveHeight(vec2 p, float t) {
  return sin(p.x * 0.14 + t * 1.1) * 0.16
       + sin((p.x * 0.6 + p.y) * 0.09 + t * 0.7) * 0.12
       + sin(p.y * 0.21 - t * 1.6) * 0.08;
}

void main() {
  vec2 wp = (world * vec4(position, 1.0)).xz;
  float h = waveHeight(wp, uTime);

  vec3 displaced = position + vec3(0.0, h, 0.0);

  // Approximate the wave normal with finite differences.
  float e = 1.6;
  float hx = waveHeight(wp + vec2(e, 0.0), uTime);
  float hz = waveHeight(wp + vec2(0.0, e), uTime);
  vNormal = normalize(vec3(h - hx, e, h - hz));

  vWorldPos = (world * vec4(displaced, 1.0)).xyz;
  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
`;

const WATER_FRAGMENT_SOURCE = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;

uniform vec3 uCameraPos;
uniform vec3 uSunDir;   // direction the light travels (from sun toward scene)
uniform vec3 uSunColor;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFogColor;
uniform float uFogDensity;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);

  // Fresnel: grazing angles reflect the sky (lighter), steep angles
  // look into the depths (darker).
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 color = mix(uDeepColor, uShallowColor, fresnel * 0.75);

  // Sun glints.
  vec3 L = normalize(-uSunDir);
  vec3 R = reflect(-L, N);
  float spec = pow(max(dot(R, V), 0.0), 90.0);
  color += uSunColor * spec * 0.9;

  // Manual exponential fog so the water blends into the horizon like
  // the fogged terrain (ShaderMaterial does not apply scene fog).
  float dist = length(uCameraPos - vWorldPos);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));

  // Go fully opaque as fog saturates so the far water converges to the
  // exact fog color and meets the sky's horizon band seamlessly.
  float alpha = mix(mix(0.78, 0.94, fresnel), 1.0, fog);
  gl_FragColor = vec4(color, alpha);
}
`;

/**
 * Animated ocean surrounding the island.
 *
 * A single large plane displaced by sine waves in the vertex shader.
 * Slight transparency lets the sandy seabed show through near the
 * shore, producing the shoreline transition without extra geometry.
 */
export class OceanSystem {
  private material: ShaderMaterial | null = null;
  private elapsedSeconds = 0;

  constructor(private readonly config: WorldConfig) {}

  build(scene: Scene): Mesh {
    const { oceanSize, oceanSubdivisions, seaLevel } = this.config;

    // Opaque seafloor under the whole ocean: everything seen through
    // the semi-transparent water is this one dark surface, so the
    // sunken terrain rim never shows as a silhouette line.
    const seafloor = CreateGround('seafloor', { width: oceanSize, height: oceanSize }, scene);
    seafloor.position.y = seaLevel - 10;
    const seafloorMaterial = new StandardMaterial('seafloor-mat', scene);
    seafloorMaterial.diffuseColor = new Color3(0.05, 0.09, 0.11);
    seafloorMaterial.specularColor = Color3.Black();
    seafloor.material = seafloorMaterial;
    seafloor.isPickable = false;
    seafloor.freezeWorldMatrix();

    const mesh = CreateGround(
      'ocean',
      { width: oceanSize, height: oceanSize, subdivisions: oceanSubdivisions },
      scene,
    );
    mesh.position.y = seaLevel;

    const material = new ShaderMaterial(
      'ocean-mat',
      scene,
      { vertexSource: WATER_VERTEX_SOURCE, fragmentSource: WATER_FRAGMENT_SOURCE },
      {
        attributes: ['position'],
        uniforms: [
          'world',
          'worldViewProjection',
          'uTime',
          'uCameraPos',
          'uSunDir',
          'uSunColor',
          'uDeepColor',
          'uShallowColor',
          'uFogColor',
          'uFogDensity',
        ],
        needAlphaBlending: true,
      },
    );
    material.setFloat('uTime', 0);

    mesh.material = material;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();

    this.material = material;
    return mesh;
  }

  /** Per-frame: advance waves and sync lighting/fog uniforms. */
  update(
    deltaSeconds: number,
    cameraPosition: Vector3,
    sunDirection: Vector3,
    sunColor: Color3,
    deepColor: Color3,
    shallowColor: Color3,
    fogColor: Color3,
    fogDensity: number,
  ): void {
    if (!this.material) {
      return;
    }
    this.elapsedSeconds += deltaSeconds;
    this.material.setFloat('uTime', this.elapsedSeconds);
    this.material.setVector3('uCameraPos', cameraPosition);
    this.material.setVector3('uSunDir', sunDirection);
    this.material.setColor3('uSunColor', sunColor);
    this.material.setColor3('uDeepColor', deepColor);
    this.material.setColor3('uShallowColor', shallowColor);
    this.material.setColor3('uFogColor', fogColor);
    this.material.setFloat('uFogDensity', fogDensity);
  }

  dispose(): void {
    this.material = null;
    this.elapsedSeconds = 0;
  }
}
