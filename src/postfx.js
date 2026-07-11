// VHS / found-footage post-processing: animated film grain, vignette, and a
// faint scanline. A single custom ShaderPass on top of the render pass.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const VHSShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.12 },
    uVignette: { value: 1.15 },
    uScanline: { value: 0.06 },
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

    // Cheap hash noise.
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;

      // Film grain, animated per frame.
      float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0);
      col += (g - 0.5) * uGrain;

      // Scanlines.
      float s = sin(uv.y * 800.0) * 0.5 + 0.5;
      col *= 1.0 - uScanline * s;

      // Vignette.
      vec2 d = uv - 0.5;
      float vig = smoothstep(0.85, 0.2, dot(d, d) * uVignette);
      col *= mix(0.55, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const vhs = new ShaderPass(VHSShader);
  vhs.renderToScreen = true;
  composer.addPass(vhs);

  return {
    composer,
    setTime: (t) => {
      vhs.uniforms.uTime.value = t;
    },
    setSize: (w, h) => composer.setSize(w, h),
  };
}
