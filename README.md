# Zein · Cloud Engineering Atlas

[Explore the island](https://zeinhaidara.github.io/cloud-portfolio/) · [All projects](https://zeinhaidara.github.io/cloud-portfolio/projects.html)

A static cloud engineering portfolio with the original full-screen 3D floating-island style. Regional systems occupy three concentric world orbits; project islands orbit their own regional centers. Three.js 0.160.0 is vendored locally with its MIT license. GitHub Pages serves the committed generated output.

Every public repository has a case study. Validation badges distinguish real cloud execution, CI with mocks, source review and work not run. Historical screenshots do not imply that an environment is still running.

## Add or update a project

Node 22 or later is required. The build and internal link checker need no dependency installation.

1. Update the source of truth, `../_audit/projects.json`, then run `node scripts/sync-data.mjs`. Only public entries and publishable fields are copied to `data/projects.json`. In a standalone checkout, edit `data/projects.json` directly, including `"visibility": "PUBLIC"`.
2. Include `name`, `title`, `summary`, `domain`, `stack`, `tier`, `repo_url`, `outcome`, `status`, `validation_level`, `known_limitations`, `next_steps`, `archived` and optional `demo_url`, `challenge_number`, `last_push`. Use facts from the audit, README or existing case study. Optional detailed context, decision, why, risk, result and diagrams go in `content/<repo-name>.html`.
3. Run `node scripts/build.mjs`, `node scripts/build.mjs --check` and `node scripts/check-links.mjs`.
4. Commit the data, source and generated output together. CI rejects stale generated output and broken internal links/fragments.

A Code Clinic challenge number automatically places a project in its five-challenge region, replaces its uncharted slot, and adds it to the list and sitemap. Public archived work goes to the Archive. Other new projects default to the capital; set an explicit home and cross-list in `data/world.json` when its domain warrants it. Nonpublic records are excluded at build time too.

## Placement

| Repository | Home | Domain cross-list |
|---|---|---|
| healthcare-eks-secops | Capital | Security & Compliance: DevSecOps |
| aws-retail-microservices-eks | Capital | Containers & Kubernetes: microservices |
| gcp-ai-log-analyzer | Capital | Observability: investigations and incident history |
| aws-3-tier-github-actions | Capital | Provisioning: application infrastructure |
| azure-aks-referral-platform | Capital | Containers & Kubernetes: AKS blueprint, source review only |
| github-actions-oidc-s3-pipeline | Capital | CI/CD & GitOps: OIDC delivery |
| cloud-portfolio, zeinhaidara | Capital | Portfolio and profile entry points |
| forest-run-unity-game | Archive | Archived game work |

Code Clinic 01 and 02 live in Provisioning and are cross-listed in the capital because the audit marks them Flagship. Challenges 31–50 remain unlinked uncharted slots until public repositories are added.

## Source layout

| Path | Purpose |
|---|---|
| `data/projects.json` | Public snapshot of the external audit |
| `data/world.json` | Regions, palettes, placements and redirects |
| `content/` | Preserved detailed case studies and diagrams |
| `src/site.css`, `src/site.js` | Shared styles and progressive interactions |
| `scripts/build.mjs`, `scripts/lib/` | Generator, geometry and vector scenery |
| `index.html`, `projects.html`, `regions/`, `projects/` | Generated Pages output |
| `memory/`, `.lighthouse/` | Ignored work notes and verification artifacts |

Legacy classic.html, space.html, healthcare.html, gcp.html and orbital.html redirect to replacements. JavaScript preserves fragments, including gcp.html#application-data-flow; redirects include fallback links. The 404 page uses a deployment base so links resolve at arbitrary path depths.

## Preview and verification

```sh
node scripts/serve.mjs
# http://127.0.0.1:4173/cloud-portfolio/
node scripts/check-links.mjs --external
npm ci
npx playwright install chromium
npm run test:browser
npm run test:world
npm run test:lighthouse
```

Browser checks cover home, a region, a detailed case study and the all-projects list at 375, 768 and 1440 pixels in both themes, search, empty states, theme persistence, keyboard map navigation, legacy fragments, reduced motion and no-JavaScript pages. CHROME_PATH can select an installed Chrome. Lighthouse writes mobile reports to .lighthouse/ and enforces performance 90/accessibility 95 on four pages. Development dependencies serve only these checks.

The 3D world has no global time, day/night or weather controls. Each region keeps its own fixed lighting, fictional temperature, terrain, flora, wildlife and local particles simultaneously. The capital opens first; World overview reveals every regional orbit. Temperatures describe the illustrated world, not real weather. Reduced motion freezes ambient movement. The build checks text, accent and badge contrast in both themes; Lighthouse checks rendered accessibility. Manual visual inspection complements automation.

The GCP case study retains the existing teammate credit. Unsupported aggregate security claims were removed; healthcare links its underlying register. Northbridge states the lack of retained deployment/resilience evidence and failing Terraform validation. Renamed repositories use their current URLs.

The WebGL landing page supersedes the former 300 KiB flat-map budget: the build checks a 900 KiB uncompressed budget including the vendored engine. A no-JavaScript/no-WebGL region list remains available, alongside the all-projects page. `src/world3d.js` extends the original renderer; `src/orbital.js` handles regional navigation; `scripts/lib/orbital-home.mjs` generates the homepage and its project data. No wall-clock time or live weather service drives this world.
