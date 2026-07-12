import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

import type { BuildingDef } from './BuildingCatalog';

/**
 * Generates a stylized building template mesh from a BuildingDef:
 * a vertex-colored box body with a pyramid roof, merged into one mesh.
 * Templates are hidden; placements are hardware instances of them
 * (one draw call per building TYPE, not per building).
 */
export function buildBuildingTemplate(scene: Scene, def: BuildingDef, cellSize: number): Mesh {
  const width = def.cellsW * cellSize * 0.82;
  const depth = def.cellsD * cellSize * 0.82;

  const body = CreateBox('body', { width, depth, height: def.bodyHeight }, scene);
  body.position.y = def.bodyHeight / 2;
  paint(body, def.bodyColor.r, def.bodyColor.g, def.bodyColor.b);

  // Four-sided pyramid roof with a slight overhang. The 45° alignment
  // is baked into the vertices FIRST so the depth stretch afterwards
  // extends the ridge instead of shearing the pyramid into a diamond.
  const roof = CreateCylinder(
    'roof',
    {
      height: def.roofHeight,
      diameterTop: 0,
      diameterBottom: width * Math.SQRT2 * 1.12,
      tessellation: 4,
    },
    scene,
  );
  roof.rotation.y = Math.PI / 4; // align pyramid faces with the walls
  roof.bakeCurrentTransformIntoVertices();
  roof.scaling.z = depth / width; // stretch for rectangular footprints
  roof.position.y = def.bodyHeight + def.roofHeight / 2;
  paint(roof, def.roofColor.r, def.roofColor.g, def.roofColor.b);

  const merged = Mesh.MergeMeshes([body, roof], true, true);
  if (!merged) {
    throw new Error(`[BuildingFactory] failed to merge template "${def.id}"`);
  }
  merged.name = `building-${def.id}`;

  const material = new StandardMaterial(`building-${def.id}-mat`, scene);
  material.diffuseColor = Color3.White(); // vertex colors carry the look
  material.specularColor = Color3.Black();
  // Soft emissive floor so sun-averted walls stay warm and readable
  // instead of falling to near-black — cozy stylized look over realism.
  material.emissiveColor = new Color3(def.bodyColor.r * 0.32, def.bodyColor.g * 0.3, def.bodyColor.b * 0.28);
  merged.material = material;
  // Buildings cast shadows onto the terrain but don't receive them:
  // the roof overhang would otherwise darken the building's own walls.
  merged.receiveShadows = false;
  merged.isPickable = false;
  merged.isVisible = false; // template only — instances are visible

  return merged;
}

function paint(mesh: Mesh, r: number, g: number, b: number): void {
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
}
