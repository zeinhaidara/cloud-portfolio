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

The world engine retains only the original day palette. Constant-false solo-scene branches were removed from this engine only; the case-study renderer retains its actual solo behavior. Shared-model extraction across renderers and broader CSS cleanup are deferred because they would increase preservation risk without fixing behavior.

No screenshot assets, original project simulators, content attribution, or project evidence are replaced. Generated pages remain produced by `scripts/build.mjs`.

Validation commands and browser-tool prerequisites are documented in the README. Browser checks use Chromium; physical-device performance, other browser engines and live external applications require separate verification. Procedural scenery is random, so side-by-side visual inspection is not a pixel-equality test.

## Weather-sphere continuation

Continued from `e095912` and `e77a1e3` without replacing the sphere architecture. Completed daytime metadata and generated pages, fixed lost vertex colours in baked LOD copies, smoothed particle tiers and distance fades, culled off-screen particle updates, and made reduced-motion rendering demand-driven. Fixed pinch jumps after a one-finger drag and continuation after lifting one finger. The existing zone LOD now batches opaque islands at distance without changing their geometry; near meshes and selection proxies remain intact.

Regression checks cover all twelve navigation destinations, non-capital selection, colour retention, particle culling, zero idle render callbacks, repeated-tour GPU resource stability, and actual multi-touch input. The headless desktop overview measured 251 to 227 draw calls with the same 116105 triangles. Idle reduced-motion callback count over 600 ms fell from 37 to zero. The 4x CPU-throttled mobile baseline measured 9.5 FPS; the final sample measured 11.7 FPS with the portrait overview fitted to all zones. These short samples use different overview framing and remain below smooth interactive performance; they are not a physical-device benchmark. Pixel ratio dropped from 1.5 to 1.25 under load and returned to 1.5 after the throttle was removed. No distant sphere or terrain silhouette was removed.

Portrait overview framing now fits the horizontal field of view, without changing the original capital framing or tilt. Existing zone labels use their icons in this compact overview to keep terrain visible; their names remain available to assistive technology, keyboard focus and the unchanged bottom chips. Explicit navigation also clears the initial intro camera offset.
