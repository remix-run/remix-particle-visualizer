export const COPY_PROMPT = `Build a full-screen 3D particle visualizer web app with the following architecture and features.

## Stack

- Remix UI mounted from a Vite \`index.html\` single-page app
- Tailwind CSS v4 (for base reset / fonts only; all visualizer UI uses plain CSS)
- Three.js for WebGL rendering
- TypeScript throughout
- Monospace font: JetBrains Mono

## Overview

A full-viewport black canvas renders 160,000+ GPU particles via a custom GLSL ShaderMaterial. Particles are positioned entirely in the vertex shader — no CPU-side position updates. Six visualization presets morph smoothly between each other. The UI floats over the canvas as translucent glass panels.

## Particle System

All particle positions and colors are computed in the vertex shader. Each particle has three attributes:
- aIndex (float): sequential index 0..N-1
- aSize (float): fixed at 1.0
- aRandom (float): Math.random() per particle, used for the intro animation

Key uniforms:
- uTime (float): elapsed seconds
- uCount (float): total particle count
- uPointSize, uPixelRatio: for size calculation
- uPresetA, uPresetB (int): active preset indices
- uBlend (float): 0..1 blend factor between presets
- uCtrlA[8], uCtrlB[8]: up to 8 control values per preset
- uSeparation (float): explosion separation per preset
- uIntroProgress (float): 0..1.5 intro animation progress
- uDofAmount, uDofFocus: depth-of-field parameters
- uCarLaneOffset (float): car lateral position driven by mouse X in Drive preset
- uCarLaneActivity (float): 0..1 decay metric tracking how actively the car is steering, computed on CPU
- uCarPosY (float): vertical car offset from \_carPosY control
- uModelTex0..3 (sampler2D): 512x256 RGBA float textures holding model point clouds
- uModelCount0..3: number of points in each model texture

### Vertex Shader Structure

1. Helper: hsl2rgb(h, s, l) — standard HSL to RGB conversion
2. Helper: grHash(fi, k) — precision-preserving golden-ratio hash that splits the particle index into 128-wide hi/lo halves to avoid float32 quantization artifacts at high particle counts
3. Helper: hash11(p) — simple float hash for randomization
4. Helper: brandGradient(ratio, t) — animated rainbow gradient using full HSL hue sweep, used for brand color mode and Drive trail particles
5. Helper: sampleModel(slot, fi) — reads a point position from a DataTexture by computing UV from a flat index (supports 4 slots)
6. Six preset functions, each computing (pos, col) from (fi, cnt, time, c0..c7)
7. computePreset() dispatcher that calls the correct preset by ID
8. main(): computes positions for both presetA and presetB, blends them with power-sigmoid ease, applies separation offset, cursor repulsion displacement (screen-space distance to uMousePos with Gaussian falloff, projected back to world space via inverse modelView), optional brand gradient or height-based color override via uColorMode, intro animation, point size with DOF, and distance-based alpha fade

### Fragment Shader

Renders soft glowing point sprites: circular mask with discard for d>0.5, exponential glow + smoothstep core, DOF blur (controlled by vCoc varying), optional fog fading by view distance. A uHdrIntensity uniform (default 1.0) multiplies the final color — values above 1.0 push fragments past [0,1] so the bloom pass flares dramatically, creating a simulated HDR "pop" effect. Uses additive blending with no depth write.

### Point Size Formula

\`\`\`
baseSize = aSize * uPointSize * uPixelRatio * (300.0 / viewDist)
coc = abs(viewDist - uDofFocus) * uDofAmount * 0.01  (if DOF enabled)
gl_PointSize = clamp(baseSize + coc * 12.0, 1.0, 128.0)
\`\`\`

## Six Presets

Preset order in the morph slider: Racetrack, Racecar, Model Kit Runner, Website Mockups, Under The Hood, Drive.

### 0: Racetrack (procedural)
Streaming mountain road scene with perspective rush. Controls: Speed (0.1-10, default 0.10), Track Width (5-60, default 40), Curve Intensity (0-25, default 10), Hill Height (5-40, default 7.8), Fog mode toggle (0/1, default 1), Star Density (0-0.3, default 0.005), Curve Sway Speed (0-2, default 0). Has custom camera position [-0.80, -18.60, 81.40] looking at [0, -4.20, -30] with per-preset camera controls for all 6 DOF.

Particles are divided into 5 groups by index: road surface (10%), left curb (5%), right curb (5%), left hillside (40%), right hillside (40%). Remaining particles become stars. Each group scrolls along z using fract(grHash(fi, phi) - time * speed * 0.12) with quadratic depth mapping z = zNear + (zFar-zNear) * along^2 for perspective compression. Hills use layered sine-wave terrain with HSL green coloring. Curbs alternate red-white stripes. Fog mode toggles between per-particle color fade and scene-level fog.

### 1: Racecar (model-based, with procedural fallback)
Reads positions from model texture slot 1. Controls: Scale (5-150, default 48), Spin Speed (0-1, default 0.23), Shimmer (0-2, default 0.6). Spins the model around Y axis. Color: blue-tinted HSL based on vertical position with shimmer pulse. Has 3D-anchored labels ("FRONTEND", "EVERYTHING IN BETWEEN", "BACKEND") that track model rotation.

**Procedural fallback** (slot 1): Generate ~20k points forming a low-poly car silhouette. Body: elongated box (-0.5..0.5 X, -0.15..0.1 Y, -0.7..0.7 Z) with points on all 6 faces. Cockpit: tapered box on top (-0.3..0.3 X, 0.1..0.25 Y, -0.2..0.3 Z). Hood: wedge sloping from cockpit front down to body front. Rear wing: thin box (-0.4..0.4 X, 0.15..0.2 Y, -0.65..-0.55 Z). Distribute points uniformly on surfaces using random UV sampling per face, weighted by face area.

### 2: Model Kit Runner (model-based, with procedural fallback)
Reads positions from model texture slot 2. Controls: Scale (5-150, default 50), Spin Speed (0-1, default 0.23), Shimmer (0-2, default 0.5). Spins the model around Y axis. Color: blue-tinted HSL based on vertical position with shimmer pulse. Has 3D-anchored labels ("EASY FOR HUMANS AND MODELS", "ALL THE PARTS YOU NEED").

**Procedural fallback** (slot 2): Generate ~20k points forming a running humanoid figure. Head: sphere (radius 0.08, center [0, 0.55, 0]). Torso: cylinder (radius 0.07, height 0.25, center [0, 0.35, 0]) tilted 15° forward. Arms: two cylinders (radius 0.03, length 0.22) extending from shoulders, one forward and one back to suggest a running pose. Legs: two cylinders (radius 0.04, length 0.28) from hips, one extended forward, one back in mid-stride. Distribute points on cylinder/sphere surfaces.

### 3: Website Mockups (model-based, with procedural fallback)
Reads positions from model texture slot 0. Controls: Scale (5-80, default 55), Rotate X (-180..180, default 18), Rotate Y (-180..180, default 0), Rotate Z (-180..180, default -14.4), Spin Speed (0-1, default 0.23). Applies Euler rotation (XYZ order) with continuous Y spin. Color: blue-tinted HSL with sine-wave luminance animation.

**Procedural fallback** (slot 0): Generate ~20k points forming 5 rectangular "screens" arranged in a fan. Each screen is a flat rectangle (0.4 wide × 0.3 tall, points on front face only). Arrange them in a semicircular arc: center screen at [0, 0, 0], two flanking screens at ±30° rotated around Y and offset ±0.25 X, two outer screens at ±55° and ±0.45 X. Add a thin border frame (extra points along edges) for each screen.

### 4: Under The Hood (model-based, with procedural fallback)
Reads positions from model texture slot 1 (same model as Racecar). Custom camera position [0, 12, -55] looking at [0, -2, 0] for a rear view. Controls: Scale (5-200, default 90), Spin Speed (0-1, default 0), Shimmer (0-2, default 0.6).

**Procedural fallback**: Uses the same slot 1 geometry as Racecar — no additional generation needed.

### 5: Drive (procedural + model hybrid, with procedural fallback)
A car model (slot 3) driving on a procedural racetrack with a brand-gradient particle trail. Custom camera position [-0.80, -18.60, 81.40] looking at [0, -4.20, -30]. System overrides: trailIntensity 0.5, cursorRepulsion 0.

Controls: Speed (0.1-10, default 2.3), Track Width (5-60, default 40), Curve Intensity (0-25, default 0), Wheel Thickness (0.02-0.5, default 0.18), Wheelbase F/R (0.2-2.0, default 1.14), Wheel Track L/R (0.2-2.0, default 0.68), Wheel Y Position (-1.0-0.5, default -0.13), Wheel Z Offset (-0.5-0.5, default -0.11), Car Y Position (-15-15, default -3.15).

Particle budget split: 88% racetrack (hills reduced to accommodate trail), 4% trail, 6.4% car body, 1.6% wheels. The racetrack portion delegates to presetRacetrack with hardcoded defaults (hillH=7.8, fogMode=1, starDensity=0.02, curveSway=0).

**Car**: Positioned at carZ=52 on the track, carScale=7.5. Mouse X steers the car laterally via uCarLaneOffset (smoothed at 0.06 lerp rate). Car body samples model texture slot 3. Four wheels are procedurally generated as spinning discs (golden-angle sunflower distribution, radius 0.12) with configurable positions via wheel controls (c3-c7). Wheel spin speed = drive speed × 20. Wheels colored to match car body (blue-tinted HSL).

**Procedural fallback** (slot 3): Generate ~20k points using the same car silhouette as slot 1 but with higher edge density (more points concentrated along sharp edges like the wing, hood line, and body seams) for a crisper look at the Drive preset's viewing distance.

**Trail**: 9 discrete rectangular ring outlines that stream away from the car's rear. Each particle is permanently assigned to one of 9 rings via hash; each ring scrolls smoothly via fract(ringSlot/9 + time*speed*0.15). Rings start at carZ + carScale (rear of car) and travel 9 units of depth. Ring shape: particles distributed along rectangle perimeter (6×3 units at origin, shrinking to 0×0 at max age) with 0.05 jitter. Color: brandGradient(age + time*0.08, time*0.25) — uniform color bands that sweep with distance, not per-particle randomization. Fade: (1 - age²) × 0.1 intensity.

**Trail fluid dynamics**: Trail follows car's current lane position directly (trailLaneX = laneX). A sinusoidal wave sway (sin(time*speed*2 - age*8) * laneX * age * 0.5) is modulated by uCarLaneActivity — a CPU-computed metric that ramps up when steering (gain 20×) and decays at 0.97/frame when holding still. This makes the trail ripple fluidly during turns and straighten when driving steady.

## Morph / Blend System

A morph slider (vertical, left side) maps to a continuous float 0..N-1 where N is the preset count (6). The vertex shader receives uPresetA, uPresetB, and uBlend. When blend > 0.001, both presets are evaluated and positions/colors are mixed with a power-sigmoid ease: t = blend^k / (blend^k + (1-blend)^k), where k = uMorphEase (default 2.3). At k=1 the blend is linear, k=2 gives a smooth S-curve similar to smoothstep, and higher values produce a sharper snap. Scrolling (wheel/touch/arrow keys) adjusts the morph value continuously. Clicking a preset name animates to it with exponential ease (speed=4.0, tick each rAF).

## Engine / Post-Processing

Three.js setup: WebGLRenderer (no antialias, no alpha), PerspectiveCamera (FOV 60, near 0.1, far 2000), OrbitControls (damping, no zoom, rotate speed 0.5). EffectComposer with RenderPass + UnrealBloomPass (strength 0.8, radius 0.4, threshold 0) + AfterImagePass for trail ghosting. ResizeObserver handles container resize.

## Camera System

Each preset can specify cameraPosition and cameraTarget [x,y,z]. During morph transitions, camera lerps between preset positions at speed 0.025. Mouse X position adds parallax offset (range ±9 units, lerped at 0.04). Racetrack preset has user-adjustable camera controls (6 sliders for position and look-at target). Drive preset uses the same camera position as Racetrack but without adjustable controls; mouse X steers the car instead of moving the camera. OrbitControls are disabled when in Drive proximity.

## Ambient Glow

A full-viewport radial gradient overlay (pointer-events: none, z-index 0) interpolates its color between per-preset glowColor values [r,g,b] (0-1 range) as the morph slider moves. Intensity is user-adjustable (default 0.40).

## Intro Animation

On load, particles rush in from in front of the camera over ~3.5 seconds — starting large/close and settling back into their final positions. Each particle has a random delay (aRandom * 0.7s). The intro uses cubic ease-out for the approach, an opacity ramp after landing, and a bright pulse on impact (9× luminance) that decays exponentially.

## Model Point Clouds

Model-based presets read particle positions from 512×256 RGBA Float32 DataTextures (4 slots: 0-3). The vertex shader samples these textures by computing UV from a flat index.

### Procedural Generation (default)

On startup, generate point clouds for each model slot using the procedural fallback geometry described in each preset section above. For each slot, fill a Float32Array with ~20,000 XYZ positions (normalized to roughly -1..1 range), upload to a DataTexture, and set the corresponding uModelCount uniform. Points should be distributed on primitive surfaces (boxes, cylinders, spheres) using random UV sampling weighted by face/surface area.

### Optional: External .pts Files

For higher-fidelity models, the system can optionally load .pts files — a custom binary format:
- Header (36 bytes): magic "PTS1", uint32 count, uint32 flags (bit 0 = has colors), 6x float32 bounding box (minX,minY,minZ,maxX,maxY,maxZ)
- Positions: count × 3 int16 (quantized to bounding box)
- Colors (optional): count × 3 uint8 (RGB 0-255)

These can be baked from GLB files via a build script with edge-biased sampling. If a .pts file is available for a slot, it replaces the procedural fallback.

## 3D-Anchored Labels

Model-based presets can define labels with 3D anchor points and 2D screen offsets. Labels track model rotation in real time via CPU-side projection: the anchor point is transformed through the same rotation as the preset's vertex shader (e.g., Y-axis spin for Racecar), projected through the camera, and positioned on screen with the specified pixel offset. Label anchor positions are adjustable via auto-generated per-axis controls.

## UI Components

### SystemPanel (top-right)
Row of icon buttons: settings gear, copy-prompt clipboard, eye toggle. Settings dropdown has sliders for: Particles (1k-500k), Point Size (0.1-5), Background Color, Bloom (0-3), Bloom Threshold (0-1), HDR Intensity (0.5-5), Cursor Repulsion (0-10), Morph Ease (0.5-5), Ambient Glow (0-0.5), DOF Amount (0-5), Focus Distance (5-300), Camera FOV (30-120), Trail Intensity, Show FPS toggle.

### ControlPanel (below SystemPanel)
Dynamically renders sliders for the active preset's controls. Binary 0/1 controls render as segmented toggles. Each preset defines its own control schema with id, label, min, max, initial. Controls prefixed with \`_\` (e.g., \_carPosY, \_fogMode, \_camPosX) are handled specially by the app for camera/car/fog positioning in addition to occupying a shader control slot.

### MorphSlider (left side, vertically centered)
Vertical track with draggable thumb, preset name labels, and dot stops. Click a label to animate to that preset. Visual: blue (#2dacf9) fill track with glowing thumb and stop dots.

### HUD (top-left)
Logo image, typewriter-animated preset title with blinking cursor, description text, and scroll hint.

### Loading Screen
Full-screen black overlay with a pixel-art runner GIF and pulsing status text. Shown while models load.

## Visual Design

Dark, terminal-inspired aesthetic:
- Background: pure black (#000000)
- Text: #999999 (primary), #555555 (secondary/labels)
- Accent: #2dacf9 (slider fills, active states, glow)
- All panels use glass morphism: rgba(0,0,0,0.7) background, backdrop-filter blur(12px), 1px borders at rgba(255,255,255,0.1)
- Font: JetBrains Mono, uppercase text-transform throughout
- Animations: slide-down for dropdowns, fade-in for UI on load
- Point sprites use additive blending for ethereal glow

## Default Settings

particleCount: 160000, pointSize: 0.2, backgroundColor: "#000000", bloomStrength: 0.8, bloomThreshold: 0, dofAmount: 0, dofFocus: 80, cameraFov: 60, glowIntensity: 0.40, hdrIntensity: 1.0, cursorRepulsion: 0.2, morphEase: 2.3, showFps: true, colorMode: 0, trailIntensity: 0.23

## Key Technical Details

- All particle positions computed in vertex shader — zero CPU overhead per frame
- Preset blending uses power-sigmoid ease for organic transitions
- Golden-ratio hash (grHash) splits index into 128-wide halves to preserve float32 precision at 100k+ particles — prevents visible banding/stutter
- Model textures use NearestFilter to avoid interpolation artifacts
- OrbitControls with zoom disabled; camera moves only via preset transitions and mouse parallax (disabled in Drive preset)
- Wheel/touch/keyboard all control the same morph float for unified navigation
- Control values are passed as uniform arrays (uCtrlA/uCtrlB), mapped to preset control definitions by index order
- Drive preset steering uses CPU-smoothed lane offset with activity-decay tracking for fluid trail dynamics
- Brand gradient color mode (uColorMode > 1.5) applies animated rainbow to all particles based on spatial position; also used independently by Drive trail
`;
