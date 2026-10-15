# combat

The pistol: aiming, hitscan shots, targets, and the effects they leave.

- `combat.ts` wires it together: dummies, targets by collider, the shooter, car smoke, effects
- `shooter.ts` reads aim, fire, and reload input; casts the Rapier ray from the crosshair
- `weapon.ts` pure pistol rules: magazine, reserve, fire rate, reload timing
- `damage.ts` pure damage rules: range falloff, head shots, health, car condition
- `dummy.ts` target dummies: re-skinned mannequins that flinch, fall, and stand back up
- `gun.ts` the procedural pistol in the right hand, and its muzzle point
- `effects.ts` muzzle flash light and sprite, sparks, dust, car smoke, bullet holes
- `particles.ts` pooled camera-facing particles in one draw call
- `decals.ts` bullet holes as one instanced quad in a ring buffer
- `textures.ts` procedural canvas sprites: dot, smoke, flash, bullet hole
- `*.test.ts` Vitest checks for the pure rules
