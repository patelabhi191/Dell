// Shared helpers for @remotion/three scenes.
import React, { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useDelayRender } from "remotion";
import type * as THREE from "three";

/**
 * The post-processing composer is not ready on the very first advance() in a fresh browser tab,
 * so that frame came out blank. On the first frame each tab renders, advance a few more times
 * (holding the render until done) so the composer has drawn the picture. Put it inside the
 * <ThreeCanvas> of any scene that uses <EffectComposer>.
 */
export const WarmUp: React.FC = () => {
  const advance = useThree((s) => s.advance);
  const { delayRender, continueRender } = useDelayRender();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const handle = delayRender("Warming up post-processing");
    let n = 0;
    const tick = () => {
      advance(performance.now());
      if (++n < 3) requestAnimationFrame(tick);
      else continueRender(handle);
    };
    requestAnimationFrame(tick);
  }, [advance, delayRender, continueRender]);
  return null;
};

/** onCreated handler: logs which graphics card WebGL got (GPU vs software) to the render log. */
export const logRenderer = ({ gl }: { gl: THREE.WebGLRenderer }) => {
  const ctx = gl.getContext();
  const ext = ctx.getExtension("WEBGL_debug_renderer_info");
  const name = ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER);
  console.log(`[three] WebGL renderer: ${name}`);
};
