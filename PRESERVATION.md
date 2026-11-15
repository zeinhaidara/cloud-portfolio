# 3D preservation review

Reference: `14b0408`. Reviewed engine base: `4e74c4c`. Existing engine history is retained.

| Difference | Classification | Decision |
| --- | --- | --- |
| Capital camera and flagship orbits | Preserved | Same initial yaw -1.58, pitch 0.95, settled pitch 0.6, desktop distance 62, portrait distance 74, FOV 50/64, orbit radii 8 + 5.2 × index and angular speed 0.6 × project speed. Preserve the six models, colours, sizes and phases. |
| Larger world, zone flights, instancing, adaptive resolution | Intentional improvement | Retain the existing engine and its expanded rendering range. |
| Zone chips, search, minimap, linked labels and generated case studies | Intentional improvement | Retain navigation and accessible list content. |
| Global random sky replaced by fixed zone air | Intentional improvement with a lost control | Keep fixed biome skies and seamless blending; restore the original controls within the capital's contribution only. The overview remains neutral. |
| Missing day/night switch and weather chip | Regression | Restore original control styling, shared session sky, palettes, dawn/dusk, weather particles, night fireflies/shooting stars and storm flashes. Hide capital controls outside the capital and in list mode. |
| Original three animated case-study heroes replaced by SVG | Regression | Restore the original renderer as `hero-world.js`, using vendored r160. Keep generated SVG as the loading, no-JavaScript and failure fallback. Other case-study illustrations remain unchanged. |
| Keyboard search can leave focus in the input | Regression | Focus the visible project close button so Escape reaches the panel handler. |
| Silently ignored biome import failures | Regression / reliability | Log the actual error and show a visible status message while retaining project navigation. |
| Rendering continues behind list view | Regression / reliability | Cancel the animation request, including when list mode is selected during startup; resume without accumulating paused animation time. |
| Eight placeholder non-capital biomes | Incomplete | Leave their existing shared models and placeholder atmosphere unchanged. |
| Challenges 31–50 and additional biome scenery | Future scope | Keep uncharted islands; add no new projects or biome implementations here. |

The restored hero renderer deliberately retains the original implementation instead of adding solo-scene branches to the zone engine. Its only renderer changes are the local r160 import and freezing animation time under reduced motion. `case.js` retains intersection-based suspension and also handles document visibility.

No screenshot assets, original project simulators, content attribution, or project evidence are replaced. Generated pages remain produced by `scripts/build.mjs`.

Validation commands and browser-tool prerequisites are documented in the README. Browser checks use Chromium; physical-device performance, other browser engines and live external applications require separate verification. Procedural scenery is random, so side-by-side visual inspection is not a pixel-equality test.
