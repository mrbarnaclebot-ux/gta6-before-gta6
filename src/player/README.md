# player

The on-foot character: a kinematic Rapier capsule plus the animated mannequin.

- `player.ts` the controller: walking, wading, swimming, diving, breath and health
- `movement.ts` pure walking rules: acceleration, gravity, jump with coyote time, animation state
- `swim.ts` pure water rules: mode switch by feet depth, buoyancy, wading speed, breath and drowning
- `ledge.ts` finds a wall top or step a swimmer can pull up onto
- `avatar.ts` loads the rigged mannequin and cross-fades its clips
- `*.test.ts` Vitest checks for the pure rules
