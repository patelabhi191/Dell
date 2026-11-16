import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");

// REMOTION_GL picks the graphics backend for every CLI command (studio, still, render), e.g.
// "angle" to render on an NVIDIA GPU on Windows, "angle-egl" or "vulkan" on Linux.
const gl = process.env.REMOTION_GL;
if (gl) {
  Config.setChromiumOpenGlRenderer(gl as Parameters<typeof Config.setChromiumOpenGlRenderer>[0]);
}
