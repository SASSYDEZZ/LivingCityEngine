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

void main() {
  vec3 dir = normalize(vDirection);

  // Vertical gradient from horizon to zenith.
  float t = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uHorizonColor, uZenithColor, pow(t, 0.5));

  // Sun disc plus a soft halo.
  vec3 toSun = normalize(-uSunDir);
  float d = max(dot(dir, toSun), 0.0);
  color += uSunColor * (pow(d, 600.0) * 1.4 + pow(d, 6.0) * 0.18);

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
  ): void {
    if (!this.material) {
      return;
    }
    this.material.setColor3('uZenithColor', zenith);
    this.material.setColor3('uHorizonColor', horizon);
    this.material.setVector3('uSunDir', sunDirection);
    this.material.setColor3('uSunColor', sunColor);
    this.material.setColor3('uFogColor', fogColor);
  }

  dispose(): void {
    this.material = null;
  }
}
