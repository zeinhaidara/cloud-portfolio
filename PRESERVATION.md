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
| Placeholder non-capital biomes | Completed (Phase 2) | The seven remaining zones now have decor modules (`zones/wind.js`, `harbour.js`, `fortress.js`, `lighthouse.js`, `workshop.js`, `volcano.js`, `summit.js`) built from the same primitives, palette and baked low-poly style. Their haze, canopy and particles still come from `air.sphere`; the placeholder landforms are retired. Island models are unchanged. |
| Challenges 31–50 | Completed (Phase 2) | All fifty Code Clinic repositories are islands with generated case studies; no uncharted islands remain. |

The restored hero renderer deliberately retains the original implementation instead of adding solo-scene branches to the zone engine. Its only renderer changes are the local r160 import and freezing animation time under reduced motion. `case.js` retains intersection-based suspension and also handles document visibility.

The world engine retains only the original day palette. Constant-false solo-scene branches were removed from this engine only; the case-study renderer retains its actual solo behavior. Shared-model extraction across renderers and broader CSS cleanup are deferred because they would increase preservation risk without fixing behavior.

No screenshot assets, original project simulators, content attribution, or project evidence are replaced. Generated pages remain produced by `scripts/build.mjs`.

Validation commands and browser-tool prerequisites are documented in the README. Browser checks use Chromium; physical-device performance, other browser engines and live external applications require separate verification. Procedural scenery is random, so side-by-side visual inspection is not a pixel-equality test.

## Weather-sphere continuation

Continued from `e095912` and `e77a1e3` without replacing the sphere architecture. Completed daytime metadata and generated pages, fixed lost vertex colours in baked LOD copies, smoothed particle tiers and distance fades, culled off-screen particle updates, and made reduced-motion rendering demand-driven. Fixed pinch jumps after a one-finger drag and continuation after lifting one finger. The existing zone LOD now batches opaque islands at distance without changing their geometry; near meshes and selection proxies remain intact.

Regression checks cover all twelve navigation destinations, non-capital selection, colour retention, particle culling, zero idle render callbacks, repeated-tour GPU resource stability, and actual multi-touch input. The headless desktop overview measured 251 to 227 draw calls with the same 116105 triangles. Idle reduced-motion callback count over 600 ms fell from 37 to zero. The 4x CPU-throttled mobile baseline measured 9.5 FPS; the final sample measured 11.7 FPS with the portrait overview fitted to all zones. These short samples use different overview framing and remain below smooth interactive performance; they are not a physical-device benchmark. Pixel ratio dropped from 1.5 to 1.25 under load and returned to 1.5 after the throttle was removed. No distant sphere or terrain silhouette was removed.

Portrait overview framing now fits the horizontal field of view, without changing the original capital framing or tilt. Existing zone labels use their icons in this compact overview to keep terrain visible; their names remain available to assistive technology, keyboard focus and the unchanged bottom chips. Explicit navigation also clears the initial intro camera offset.

## Measured refinement continuation

Baseline: `8c57e08`, including the previously completed single-pass orbit rings. Final engine: `76265c5`. Continued the existing material-sharing, static-transform, batching and terrain refinements rather than replacing the engine. No CSS, models, case-study renderers, particle densities or adaptive-resolution thresholds were replaced.

Plain flat colours now share materials; animated materials remain separate. Unlit transparent ribbons, beams and the rainbow use a single two-sided pass. Distant capital models detach their unused near hierarchy, including a baked contact balloon; orbital roots still move. Static zone transforms avoid repeated local matrix composition, distant uncharted islands batch together, and large terrain flora bake with their landform. Decorative islets retain their orbits and visible details; only offscreen internal animation updates are suspended.

Retained the unfinished vertex-height shading, lighter inner haze, clearer fog in four existing zones, and separate smooth scaling for terrain landmarks versus island rings. This makes distant landforms easier to distinguish without enlarging neighbouring weather formations into one another. The existing tropical, desert and ice centrepieces use that same terrain group.

Corrected four integration problems: ghost batching had filtered out its own transparent geometry; an overview cutoff hid scenery abruptly; removing lamp lights lost local-weather illumination; and a reduced-motion return from distant LOD could leave the shield facing the previous camera. Ghost batches retain geometry, visible scenery stays present, zero-intensity lamps skip rendering but remain available, and model animation uses the current camera after LOD reattachment.

### Reproduction and measurements

Run `node scripts/profile-world.mjs --baseline 8c57e08 --output memory/world-preview/refine-before-mobile4.json`, then omit `--baseline` for the working tree. Add `--desktop` for desktop, or `--cpu 1 --ratio 1.5` for unthrottled mobile. `--screens memory/screenshots/refine-after` captures the comparison views; combine with `--baseline` for the reference. Use the existing browser-tool environment variables documented in the README. No site dependencies are added.

Chrome headless on Intel UHD Graphics through ANGLE/D3D11; desktop 1440x900/DPR 1, mobile 375x812/device DPR 2. Fixed yaw -1.58, overview distances 420/1057.653637, seed 8675309. Each condition uses two six-second captures after five seconds of warm-up and another second at the requested CPU throttle. Renderer resolution is fixed for comparison; adaptive behavior is tested separately. Full baseline files are served directly from Git without changing branches or creating another checkout.

Pairs below are capture 1 / capture 2, in milliseconds unless stated otherwise.

| Metric | Baseline | Final |
| --- | --- | --- |
| Desktop FPS | 59.88 / 59.88 | 60.05 / 60.05 |
| Mobile FPS, normal CPU | 59.71 / 59.55 | 60.05 / 60.05 |
| Mobile FPS, 4x CPU | 14.56 / 10.14 | 14.15 / 11.95 |
| Desktop frame p50; p95 | 16.7 / 16.6; 16.8 / 16.8 | 16.7 / 16.6; 16.8 / 16.9 |
| Mobile normal frame p50; p95 | 16.7 / 16.6; 16.8 / 16.8 | 16.7 / 16.6; 16.9 / 16.8 |
| Mobile 4x frame p50; p95 | 66.6 / 99.9; 83.4 / 149.8 | 66.6 / 66.6; 100 / 116.6 |
| Mobile 4x frame p99 | 99.9 / 149.9 | 133.3 / 971.7 |
| Desktop JavaScript/frame, CDP | 7.93 / 7.67 | 5.51 / 5.67 |
| Mobile normal JavaScript/frame, CDP | 6.35 / 6.56 | 4.71 / 4.56 |
| Mobile 4x JavaScript/frame, CDP | 50.82 / 73.49 | 45.85 / 43.54 |
| Mobile 4x render-call p50; p95 | 47 / 65.5; 61.8 / 105.6 | 39.6 / 35.7; 66 / 64.5 |
| Mobile 4x non-render callback p50 | 3.1 / 3.8 | 3.7 / 3.5 |
| Draw calls, desktop / mobile | 210 / 206 | 158 / 154 |
| Submitted triangles, desktop / mobile | 110905 / 94505 | 106213 / 89813 |
| Fixed renderer DPR, desktop / mobile normal / mobile 4x | 1 / 1.5 / 1.25 | 1 / 1.5 / 1.25 |
| GPU elapsed p50; p95, mobile 4x | 8.48; 19.27 | 6.63; 13.26 |
| Uploaded geometries, desktop / mobile | 391 / 387 | 373 / 373 |
| Textures | 2 | 2 |
| Browser-reported initial transfer, bytes | 894170 | 897166 |
| Reduced-motion idle callbacks | Not remeasured | 0 |

CPU profiles concentrate in Three.js rendering, program setup, matrix traversal and GL uniform/buffer submission, not weather updates or raycasting. GPU elapsed time is substantially below CPU render-call time under throttling. The measurable gain is lower render/JavaScript cost and fewer submissions; submitted triangle savings include avoided transparent passes, not deleted terrain. The throttled FPS ranges overlap, so these samples do not establish a reliable FPS gain. The final second capture includes a roughly one-second interval outside the measured animation callback; its scheduling cause is unresolved. Sustained throttled performance remains poor and must not be described as smooth mobile performance.

Initial scene construction and shader warm-up still produce long tasks (about 0.5 seconds in final captures). Git-backed reference serving changes loading latency, so startup wall-clock timing is not a deployment speed comparison. Transfer values come from local browser resource timing, not compressed production hosting. Seeded procedural scenes are comparable views rather than pixel-identical scenery, because sharing Three.js materials also changes UUID-related random-number consumption.

### Validation and remaining limits

Production generation and generated-output verification passed: 50 outputs, 39 case studies, 12 zones, 20 uncharted slots. Link checks passed: 875 internal references, 45 external links, nine browser modules and the existing privacy checks. Browser regressions passed for all twelve destinations, original sun/orbits, LOD colour and geometry retention, weather culling, atmosphere blending, search/minimap/panels, drag/zoom/pinch, startup failures, list suspension, zero reduced-motion idle callbacks, stable GPU counts across repeated tours, three original heroes, project simulators, and no-JavaScript/no-WebGL fallbacks. Added a shield-orientation regression and an adaptive downshift/recovery test using controlled frame timestamps; the latter verifies controller behavior rather than real-device recovery speed.

Reviewed 13 before/after views per revision: capital, desktop and portrait world overviews, tropical/desert/ice, containers/security/reliability, island close-up and three heroes. Terrain silhouettes, localized colours, cloud formations, original UI and near models remain present. Captures and raw profiling JSON remain local under ignored `memory/screenshots/refine-*` and `memory/world-preview/refine-*` paths. Physical phones, Safari/Firefox, long-session heap retention and the scheduling outlier remain unverified. No distant sphere was removed to meet a frame-rate target.
