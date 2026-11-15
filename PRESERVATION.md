# 3D preservation review

Reference: `14b0408`. Reviewed engine base: `4e74c4c`. Existing engine history is retained.

| Difference | Classification | Decision |
| --- | --- | --- |
| Capital camera and flagship orbits | Preserved | Same initial yaw -1.58, pitch 0.95, settled pitch 0.6, desktop distance 62, portrait distance 74, FOV 50/64, orbit radii 8 + 5.2 × index and angular speed 0.6 × project speed. Preserve the six models, colours, sizes and phases. |
| Larger world, zone flights, instancing, adaptive resolution | Intentional improvement | Retain the existing engine and its expanded rendering range. |
| Zone chips, search, minimap, linked labels and generated case studies | Intentional improvement | Retain navigation and accessible list content. |
| Global random sky replaced by fixed zone air | Intentional improvement | One daytime for the whole world. Zones keep fixed air and blend seamlessly; each also draws a local weather-and-terrain sphere that is visible from the capital. |
| Day/night switch and weather chip on the world page | Removed on request | The world page has no time-of-day or weather control and the capital is always sunny. The night, dawn/dusk, capital-weather, firefly and shooting-star code was removed from the zone engine. The case-study heroes keep `sky.js` and their control. |
| Original three animated case-study heroes replaced by SVG | Regression | Restore the original renderer as `hero-world.js`, using vendored r160. Keep generated SVG as the loading, no-JavaScript and failure fallback. Other case-study illustrations remain unchanged. |
| Keyboard search can leave focus in the input | Regression | Focus the visible project close button so Escape reaches the panel handler. |
| Silently ignored biome import failures | Regression / reliability | Log the actual error and show a visible status message while retaining project navigation. |
| Rendering continues behind list view | Regression / reliability | Cancel the animation request, including when list mode is selected during startup; resume without accumulating paused animation time. |
| Eight placeholder non-capital biomes | Minimal identity | Their haze, canopy, landform and particles come from `air.sphere` in the zone config; no per-zone code. Their island models are unchanged. |
| Challenges 31–50 and additional biome scenery | Future scope | Keep uncharted islands; add no new projects or biome implementations here. |

The restored hero renderer deliberately retains the original implementation instead of adding solo-scene branches to the zone engine. Its only renderer changes are the local r160 import and freezing animation time under reduced motion. `case.js` retains intersection-based suspension and also handles document visibility.

The world engine reads the day half of the original palette. Constant-false solo-scene branches were removed from this engine only; the case-study renderer retains its actual solo behavior. Shared-model extraction across renderers and broader CSS cleanup are deferred because they would increase preservation risk without fixing behavior.

No screenshot assets, original project simulators, content attribution, or project evidence are replaced. Generated pages remain produced by `scripts/build.mjs`.

Validation commands and browser-tool prerequisites are documented in the README. Browser checks use Chromium; physical-device performance, other browser engines and live external applications require separate verification. Procedural scenery is random, so side-by-side visual inspection is not a pixel-equality test.
