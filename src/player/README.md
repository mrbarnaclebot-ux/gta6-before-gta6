# player

The on-foot character: a kinematic Rapier capsule plus an animated figure (the generated man; people use the man and woman).

- `player.ts` the controller: walking, wading, swimming, diving, breath and health
- `movement.ts` pure walking rules: acceleration, gravity, jump with coyote time, animation state
- `swim.ts` pure water rules: mode switch by feet depth, buoyancy, wading speed, breath and drowning
- `ledge.ts` finds a wall top or step a swimmer can pull up onto
- `avatar.ts` the player's figure: cross-fades its clips and holds the gun hand
- `figure.ts` loads the mannequin (which carries every clip) and the generated man and woman, stands them up at their heights
- `bone-map.ts` finds a generated rig's humanoid bones by shape and maps them to the mannequin's
- `retarget.ts` bakes the mannequin's clips onto another rig on first use, lining up the two rest poses
- `aim-pose.ts` the pistol upper-body layer: aim up and down, recoil, reload, over any leg clip
- `*.test.ts` Vitest checks for the pure rules
