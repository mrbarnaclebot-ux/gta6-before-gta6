# Asset credits

All files are free-licensed. Downloaded as untrusted data (binary only). Total size about 31 MB.

## HDRI (Poly Haven, CC0)
- hdri/day_kloofendal_2k.hdr (2k) - https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky - Greg Zaal, sky edits Jarod Guest - CC0
- hdri/night_dikhololo_1k.hdr (1k) - https://polyhaven.com/a/dikhololo_night - Greg Zaal - CC0

## PBR textures, 1k (Poly Haven, CC0). Each folder: diff.jpg (color), nor_gl.jpg (OpenGL normal), rough.jpg (roughness)
- textures/asphalt_02 - https://polyhaven.com/a/asphalt_02 - Rob Tuytel
- textures/concrete_pavement_02 - https://polyhaven.com/a/concrete_pavement_02 (sidewalk) - Charlotte Baglioni
- textures/coast_sand_01 - https://polyhaven.com/a/coast_sand_01 (beach) - Rob Tuytel
- textures/aerial_grass_rock - https://polyhaven.com/a/aerial_grass_rock (grass) - Rob Tuytel
- textures/white_stucco - https://polyhaven.com/a/white_stucco (art-deco plaster facade) - Amal Kumar
- textures/concrete_tile_facade - https://polyhaven.com/a/concrete_tile_facade (tiled facade) - Charlotte Baglioni
- No glass/window texture found; use a procedural window grid or MeshPhysicalMaterial glass.

## Water
- textures/water/waternormals.jpg - https://github.com/mrdoob/three.js/blob/dev/examples/textures/waternormals.jpg - three.js authors - MIT

## Character
- models/character/mannequin_ual.glb (3.0 MB) - Quaternius, Universal Animation Library (Standard, free) - https://quaternius.com/packs/universalanimationlibrary.html (gltf obtained from https://github.com/J-Ponzo/gltf-universal-animation-library, repacked to glb with gltf-transform) - CC0 1.0
  - One skinned mesh named "Mannequin" (neutral mannequin, not photoreal), Rigify-style DEF-* bones, 1 skin, 46 clips:
  - A_TPose, Crouch_Fwd_Loop, Crouch_Idle_Loop, Dance_Loop, Death01, Driving_Loop, Fixing_Kneeling, Hit_Chest, Hit_Head, Idle_Loop, Idle_Talking_Loop, Idle_Torch_Loop, Interact, Jog_Fwd_Loop, Jump_Land, Jump_Loop, Jump_Start, PickUp_Table, Pistol_Aim_Down, Pistol_Aim_Neutral, Pistol_Aim_Up, Pistol_Idle_Loop, Pistol_Reload, Pistol_Shoot, Punch_Cross, Punch_Enter, Punch_Jab, Push_Loop, Roll, Roll_RM, Sitting_Enter, Sitting_Exit, Sitting_Idle_Loop, Sitting_Talking_Loop, Spell_Simple_Enter, Spell_Simple_Exit, Spell_Simple_Idle_Loop, Spell_Simple_Shoot, Sprint_Loop, Swim_Fwd_Loop, Swim_Idle_Loop, Sword_Attack, Sword_Attack_RM, Sword_Idle, Walk_Formal_Loop, Walk_Loop
  - Covers idle, walk, jog, sprint, jump (start/loop/land), swim, pistol aim/shoot/reload, driving (seated pose).

## Vehicle
- models/vehicle/car_concept.glb (9.1 MB) - "CarConcept", Eric Chadwick, (c) 2024 Darmstadt Graphics Group GmbH - https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept - CC-BY 4.0 (attribution required: keep this entry). Textures re-encoded to WebP (gltf-transform), no other changes.
  - Realistic PBR sports coupe, about 2.2 m wide, 4.3 m long, 0.9 m high. Root node 0 "BodyUnderside" carries a rotation (model is Z-up, converted by that node) and holds all children.
  - Wheel nodes (each contains Rim, BrakePad, BrakeDisc, and an unnamed tire mesh): WheelFrontL, WheelFrontR, WheelRearL, WheelRearR.
  - Body parts: BodyHood, BodyDoorRColor1, BodyDoorLColor1, BodyRearPanelsColor1, BodyPanelsColor2, BodyWindshield, BodyRearwindow, BodyHeadlights, BodyTaillights, BodyTurnsignalsRear, "License Plate", InteriorSteeringWheel01..04, Axles.
  - Materials include Glass (KHR transmission), clearcoat paint "Paint 1/2 Carmine|Pearl|Graphite", Headlight, Brakelight, Signallight. Uses KHR_materials_variants, clearcoat, iridescence, transmission, emissive_strength, texture_transform.
  - Has no baked animation; spin wheel nodes in code. Heavy mesh (about 1M vertices render cost): consider hiding interior nodes (names starting "Interior", "Engine") for perf.

## Vegetation
- models/vegetation/PalmTree_1..4.glb, Bush_1.glb, Bush_2.glb, Plant_1.glb, Plant_3.glb - Quaternius, Ultimate Stylized Nature - https://quaternius.com/packs/ultimatenature.html (glb copies from https://github.com/trebeljahr/quaternius-showcase) - CC0 1.0. Low-poly stylized, one mesh each, vertex-color materials (Wood, Green, DarkGreen for palms). Palms are stylized, not photoreal.
- models/vegetation/ph_fern_02.glb (1.1 MB) - Poly Haven "Fern 02", Rob Tuytel (scan), Rico Cilliers (model), https://polyhaven.com/a/fern_02 - CC0. Nodes fern_02_a..d. 1k textures embedded (repacked from gltf with gltf-transform).

## Props
- models/props/Streetlight_Single.glb, Streetlight_Double.glb, TrafficLight.glb, Sign_Stop.glb - Quaternius, Ultimate Modular Streets / street pack - https://quaternius.com (glb copies from https://github.com/trebeljahr/quaternius-showcase) - CC0 1.0. Streetlight materials: Green, Glass, Light (emissive for night); single root mesh named after the file.

## Not found / skipped
- No CC0 photoreal palm tree glb found (Poly Haven has none). Palms above are stylized.
- Poly Haven island_tree_01 (tropical-looking, realistic) is 66 MB at 1k: skipped for size.
- Photoreal humanoid with a full animation set under CC0 not found; Mixamo-based three.js Soldier/Xbot/Michelle have unclear (Adobe) license and were skipped. three.js ferrari.glb skipped: license unclear (Sketchfab author vicent091036, original page no longer resolvable).
- No bench/cone prop downloaded (optional).
