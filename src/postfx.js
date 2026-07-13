// VHS / found-footage post-processing.
//
// Two tiers live here:
//   * The BASE tier (grain, vignette, faint scanline) is always on — Feature 01's
//     clean-but-grainy gameplay look.
//   * The FOUND tier (chromatic aberration, tracking bands, vertical roll, signal
//     dropout, bloom) is gated behind `uFound` and only cranked up during
//     cut-scenes (Feature 04). At uFound=0 the extra maths collapse to no-ops, so
//     gameplay pays nothing for them.
//
// `uDistortion` (0..1) scales the found-tier intensity within a cut-scene; the
// default sits at a "moderate" 0.5 — clearly found-footage while staying legible.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const VHSShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.12 },
    uVignette: { value: 1.15 },
    uScanline: { value: 0.06 },
    // Found-footage (cut-scene) tier.
    uFound: { value: 0 }, // 0 = clean gameplay, 1 = full camcorder feed
    uDistortion: { value: 0.5 }, // intensity within found mode (default moderate)
    uAberration: { value: 0.005 }, // base RGB split at the edges
    uDropout: { value: 0 }, // brief signal-loss bursts, driven per-frame
    // Flat colour tint (e.g. a low-sanity red/grey flash) — mixed in at
    // uTintAmount (0 = no tint, 1 = solid uTintColor).
    uTintColor: { value: new THREE.Vector3(1, 0, 0) },
    uTintAmount: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uScanline;
    uniform float uFound;
    uniform float uDistortion;
    uniform float uAberration;
    uniform float uDropout;
    uniform vec3 uTintColor;
    uniform float uTintAmount;

    // Cheap hash noise.
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;

      // --- Found-tier geometry warps (no-ops when uFound == 0) ---
      float amt = uFound * (0.35 + uDistortion); // combined found intensity

      // Occasional vertical roll: mostly parked at 0, jumps for a beat.
      float sec = floor(uTime * 0.6);
      float rollGate = step(0.86, hash(vec2(sec, 3.0)));
      float roll = rollGate * fract(uTime * 0.6) * 0.5 * amt;
      uv.y = fract(uv.y + roll);

      // Tracking band: a bright horizontal band scrolling up the frame that
      // tears the image sideways as it passes.
      float bandY = fract(uTime * (0.18 + uDistortion * 0.15));
      float band = smoothstep(0.045, 0.0, abs(uv.y - bandY)) * uFound;
      uv.x += band * (hash(vec2(uv.y * 140.0, floor(uTime * 15.0))) - 0.5)
              * 0.05 * (0.5 + uDistortion);

      // --- Chromatic aberration (RGB split toward the edges) ---
      vec2 d = uv - 0.5;
      float ca = uAberration * (0.4 + dot(d, d) * 2.5) * amt;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;

      // Brighten the tracking band so it reads as a tape error.
      col += band * (0.12 + uDistortion * 0.12);

      // Film grain, animated per frame; heavier in found mode.
      float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0);
      col += (g - 0.5) * (uGrain + amt * 0.14);

      // Scanlines.
      float s = sin(uv.y * 800.0) * 0.5 + 0.5;
      col *= 1.0 - (uScanline + uFound * 0.05) * s;

      // Signal dropout: desaturate, darken, and blast noise for a beat.
      if (uDropout > 0.0) {
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 drop = vec3(lum) * 0.35 + (g - 0.5) * 0.5;
        col = mix(col, drop, uDropout);
      }

      // Vignette (tightens slightly under the camcorder look).
      float vig = smoothstep(0.85, 0.2, dot(d, d) * (uVignette + uFound * 0.25));
      col *= mix(0.55, 1.0, vig);

      // Flat colour tint — a brief low-sanity red/grey flash over the whole frame.
      col = mix(col, uTintColor, uTintAmount);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Bloom sells the cheap over-exposed camcorder lens on the fluorescent
  // panels. Strength is driven to 0 during gameplay and ramped up in cut-scenes.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.0, // strength
    0.7, // radius
    0.72, // threshold — only the bright panels bloom
  );
  composer.addPass(bloom);

  const vhs = new ShaderPass(VHSShader);
  vhs.renderToScreen = true;
  composer.addPass(vhs);

  const u = vhs.uniforms;
  return {
    composer,
    setTime: (t) => {
      u.uTime.value = t;
    },
    // Found-footage master switch (0..1). Also drives bloom strength so the
    // over-exposed lens fades in with the rest of the treatment.
    setFound: (amount) => {
      u.uFound.value = amount;
      bloom.strength = amount * (0.5 + u.uDistortion.value * 0.6);
    },
    // Cut-scene distortion intensity (0..1). Default 0.5 = moderate.
    setDistortion: (amount) => {
      u.uDistortion.value = THREE.MathUtils.clamp(amount, 0, 1);
    },
    getDistortion: () => u.uDistortion.value,
    // Brief signal-loss burst (0..1), set per-frame by the cut-scene driver.
    setDropout: (amount) => {
      u.uDropout.value = amount;
    },
    // Vignette strength (defaults to 1.15). Stage 2 turns this down to 0 so
    // its much bigger area doesn't read as darkened toward the edges.
    setVignette: (amount) => {
      u.uVignette.value = amount;
    },
    // Film-grain amount (defaults to 0.12). Driven up as sanity drops — a
    // dirtier picture rather than anything that dims or occludes the scene,
    // so it doesn't affect how well the player can actually see.
    setGrain: (amount) => {
      u.uGrain.value = amount;
    },
    // Flat colour tint over the whole frame — color as [r,g,b] in 0..1,
    // amount 0..1 (0 = invisible, 1 = solid colour). Used for the brief
    // low-sanity red/grey flash (see main.js's sanity-loss flash driver).
    setTint: (color, amount) => {
      u.uTintColor.value.set(color[0], color[1], color[2]);
      u.uTintAmount.value = amount;
    },
    getTint: () => ({ color: u.uTintColor.value.toArray(), amount: u.uTintAmount.value }),
    setSize: (w, h) => {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
    // Swap which scene the render pass draws — used to switch between the
    // main game, Stage 2, and the Prop Room, each its own separate scene.
    setScene: (newScene) => {
      renderPass.scene = newScene;
    },
  };
}
