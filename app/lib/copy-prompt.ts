export const COPY_PROMPT = `Build a full-screen 3D particle visualizer web app with the following architecture and features.

## Stack

- React Router v7 (Remix) with Vite
- Tailwind CSS v4 (for base reset / fonts only; all visualizer UI uses plain CSS)
- Three.js for WebGL rendering
- TypeScript throughout
- Monospace font: JetBrains Mono

## Overview

A full-viewport black canvas renders 160,000+ GPU particles via a custom GLSL ShaderMaterial. Particles are positioned entirely in the vertex shader — no CPU-side position updates. Five visualization presets morph smoothly between each other. The UI floats over the canvas as translucent glass panels.

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
- uModelTex0, uModelTex1 (sampler2D): 512x256 RGBA float textures holding model point clouds
- uModelCount0, uModelCount1: number of points in each model texture

### Vertex Shader Structure

1. Helper: hsl2rgb(h, s, l) — standard HSL to RGB conversion
2. Helper: grHash(fi, k) — precision-preserving golden-ratio hash that splits the particle index into 128-wide hi/lo halves to avoid float32 quantization artifacts at high particle counts
3. Helper: sampleModel(slot, fi) — reads a point position from a DataTexture by computing UV from a flat index
4. Five preset functions, each computing (pos, col) from (fi, cnt, time, c0..c7)
5. computePreset() dispatcher that calls the correct preset by ID
6. main(): computes positions for both presetA and presetB, blends them with smoothstep, applies separation offset, cursor repulsion displacement (screen-space distance to uMousePos with Gaussian falloff, projected back to world space via inverse modelView), intro rain animation, point size with DOF, and distance-based alpha fade

### Fragment Shader

Renders soft glowing point sprites: circular mask with discard for d>0.5, exponential glow + smoothstep core, DOF blur (controlled by vCoc varying), optional fog fading by view distance. A uHdrIntensity uniform (default 1.0) multiplies the final color — values above 1.0 push fragments past [0,1] so the bloom pass flares dramatically, creating a simulated HDR "pop" effect. Uses additive blending with no depth write.

### Point Size Formula

\`\`\`
baseSize = aSize * uPointSize * uPixelRatio * (300.0 / viewDist)
coc = abs(viewDist - uDofFocus) * uDofAmount * 0.01  (if DOF enabled)
gl_PointSize = clamp(baseSize + coc * 12.0, 1.0, 128.0)
\`\`\`

## Five Presets

### 0: Remix Logo (model-based)
Reads positions from model texture slot 0. Controls: Scale (5-80, default 60), Rotate X/Y/Z (-180..180, default 0). Applies Euler rotation (XYZ order). Color: grayscale with subtle sine-wave luminance animation.

### 1: Racecar (model-based)
Reads positions from model texture slot 1. Controls: Scale (5-150, default 42), Spin Speed (0-1, default 0.2), Shimmer (0-2, default 0.6). Spins the model around Y axis. Color: green-tinted based on front-facing direction with shimmer pulse.

### 2: Racetrack (procedural)
Streaming mountain road scene with perspective rush. Controls: Speed (0.1-2, default 0.2), Track Width (5-60, default 40), Curve Intensity (0-25, default 10.25), Hill Height (5-40, default 7.8), Fog mode toggle (0/1, default 1). Has custom camera position [-0.80, -18.60, 81.40] looking at [0, -4.20, -30] with per-preset camera controls for all 6 DOF.

Particles are divided into 5 groups by index: road surface (30%), left curb (5%), right curb (5%), left hillside (30%), right hillside (30%). Each group scrolls along z using fract(grHash(fi, phi) - time * speed * 0.12) with quadratic depth mapping z = zNear + (zFar-zNear) * along^2 for perspective compression. Hills use layered sine-wave terrain with HSL green coloring. Curbs alternate red-white stripes. Fog mode toggles between per-particle color fade and scene-level fog.

### 3: Spiral Galaxy (procedural)
Controls: Spiral Arms (2-8, default 8), Tightness (0.2-2, default 1.8), Rotation Speed (0.05-1, default 0.2), Disk Height (0.5-8, default 6). Uses logarithmic spiral with differential rotation (inner spins faster). Scatter increases with distance from center. Color: warm core (orange) fading to blue in outer arms via HSL interpolation.

### 4: 4D Tesseract (procedural)
Controls: Rotation XW (0.1-2, default 0.5), Rotation YZ (0.1-2, default 0.3), Projection Dist (1.5-5, default 1.5), Edge Spread (0.5-3, default 1.09). Constructs 32 edges of a 4D hypercube, distributes particles along edges, applies 4D rotations in XW and YZ planes, then perspective-projects from 4D to 3D. Color: edge-indexed hue with brightness modulated by projection scale.

## Morph / Blend System

A morph slider (vertical, left side) maps to a continuous float 0..N-1 where N is the preset count. The vertex shader receives uPresetA, uPresetB, and uBlend. When blend > 0.001, both presets are evaluated and positions/colors are mixed with a power-sigmoid ease: t = blend^k / (blend^k + (1-blend)^k), where k = uMorphEase (default 2.0). At k=1 the blend is linear, k=2 gives a smooth S-curve similar to smoothstep, and higher values produce a sharper snap. Scrolling (wheel/touch/arrow keys) adjusts the morph value continuously. Clicking a preset name animates to it with exponential ease (speed=4.0, tick each rAF).

## Engine / Post-Processing

Three.js setup: WebGLRenderer (no antialias, no alpha), PerspectiveCamera (FOV 60, near 0.1, far 2000), OrbitControls (damping, no zoom, rotate speed 0.5). EffectComposer with RenderPass + UnrealBloomPass (strength 1.0, radius 0.4, threshold 0). ResizeObserver handles container resize.

## Camera System

Each preset can specify cameraPosition and cameraTarget [x,y,z]. During morph transitions, camera lerps between preset positions at speed 0.025. Mouse X position adds parallax offset (range ±9 units, lerped at 0.04). Racetrack preset also has user-adjustable camera controls (6 sliders for position and look-at target).

## Ambient Glow

A full-viewport radial gradient overlay (pointer-events: none, z-index 0) interpolates its color between per-preset glowColor values [r,g,b] (0-1 range) as the morph slider moves. Intensity is user-adjustable (default 0.40).

## Intro Animation

On load, particles rain in from above over ~3.5 seconds. Each particle has a random delay (aRandom * 0.7s). The intro uses cubic ease-out for fall, an opacity ramp after landing, and a bright pulse on impact that decays exponentially.

## Model Loading

3D models are stored as .pts files — a custom binary format:
- Header (36 bytes): magic "PTS1", uint32 count, uint32 flags (bit 0 = has colors), 6x float32 bounding box (minX,minY,minZ,maxX,maxY,maxZ)
- Positions: count × 3 int16 (quantized to bounding box)
- Colors (optional): count × 3 uint8 (RGB 0-255)

Loaded positions are uploaded to a 512×256 RGBA Float32 DataTexture. The vertex shader samples this texture by computing UV from a flat index.

## UI Components

### SystemPanel (top-right)
Row of icon buttons: settings gear, copy-prompt clipboard, eye toggle. Settings dropdown has sliders for: Particles (1k-500k), Point Size (0.1-5), Background Color, Bloom (0-3), Bloom Threshold (0-1), HDR Intensity (0.5-5), Cursor Repulsion (0-10), Morph Ease (0.5-5), Ambient Glow (0-0.5), DOF Amount (0-5), Focus Distance (5-300), Camera FOV (30-120), Show FPS toggle.

### ControlPanel (below SystemPanel)
Dynamically renders sliders for the active preset's controls. Binary 0/1 controls render as segmented toggles. Each preset defines its own control schema with id, label, min, max, initial.

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

particleCount: 160000, pointSize: 0.2, backgroundColor: "#000000", bloomStrength: 1.0, bloomThreshold: 0, dofAmount: 0, dofFocus: 80, cameraFov: 60, glowIntensity: 0.40, hdrIntensity: 1.0, cursorRepulsion: 0, morphEase: 2.0, showFps: true

## Key Technical Details

- All particle positions computed in vertex shader — zero CPU overhead per frame
- Preset blending uses smoothstep for organic transitions
- Golden-ratio hash (grHash) splits index into 128-wide halves to preserve float32 precision at 100k+ particles — prevents visible banding/stutter
- Model textures use NearestFilter to avoid interpolation artifacts
- OrbitControls with zoom disabled; camera moves only via preset transitions and mouse parallax
- Wheel/touch/keyboard all control the same morph float for unified navigation
- Control values are passed as uniform arrays (uCtrlA/uCtrlB), mapped to preset control definitions by index order
`;
