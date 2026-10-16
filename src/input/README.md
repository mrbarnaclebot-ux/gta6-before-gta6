# input

The action layer: keyboard and mouse, gamepad, and touch all feed the same actions (`bindings.ts`) and analog axes, so game code reads `input.held`, `consume`, `move()`, `drive()`, and `consumeLook()` without knowing the device.

- `input.ts` the `Input` class: held and pressed actions per source, stick axes, look deltas, and which device's labels to show (`data-input` on `<html>`); keyboard and mouse live here
- `bindings.ts` actions and the keyboard and mouse bindings
- `analog.ts` pure stick math: radial deadzone and response curve, triggers, the floating thumbstick
- `pad-map.ts` pure gamepad mapping (standard layout) from buttons and sticks to actions and axes
- `gamepad.ts` polls the Gamepad API each frame, handles hot-plug, and hands the pad to the menus while one is open
- `pad-menu.ts` D-pad and A/B navigation over the DOM menus
- `touch.ts` phone and tablet controls: thumbstick, drag to look, and context buttons (styles in `src/ui/touch.css`)
