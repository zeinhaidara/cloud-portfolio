# M. Zein Haidara · Cloud Engineering

Cloud engineer focused on AWS, Azure, Kubernetes, and infrastructure automation.

**Portfolio:** https://zeinhaidara.github.io/cloud-portfolio/ · **Contact:** zeinhaidara@gmail.com · **GitHub:** [@zeinhaidara](https://github.com/zeinhaidara)

Each project is built the way production platforms are: infrastructure as code, least-privilege access, automated delivery, and evidence captured from running systems.

## Engineering approach

- **Infrastructure as code.** Terraform defines the platform; Helm, GitHub Actions, and Azure DevOps deliver it. Every change traces to a commit.
- **Least privilege.** Scoped IAM roles and workload identity at runtime, short-lived OIDC credentials in pipelines, no long-lived keys.
- **Verified delivery.** Validation, tests, security scans, immutable images, and post-deploy smoke checks.
- **Observability and load.** Prometheus, Grafana, and CloudWatch alarms, plus load tests that exercise autoscaling.

## Projects

| Project | Focus | Links |
|---|---|---|
| **Healthcare SecOps** | Patient API on EKS Fargate behind CI scan gates, GitOps (Argo CD), approval-gated Terraform, OIDC-only access, IRSA, and detective controls. 43 logged security changes and 16 accepted risks, each with evidence. Synthetic data; no compliance claim. | [Case study](https://zeinhaidara.github.io/cloud-portfolio/healthcare.html) · [Source](https://github.com/zeinhaidara/healthcare-eks-secops) |
| **Orbital Expeditions** | Six event-driven microservices on EKS: DynamoDB reservations, RDS outbox, Valkey caching, EventBridge and SQS with a dead-letter queue, Prometheus and Grafana. | [Case study](https://zeinhaidara.github.io/cloud-portfolio/orbital.html) · [Source](https://github.com/zeinhaidara/aws-retail-microservices-eks) |
| **AWS three-tier delivery** | One FastAPI/MySQL app on EC2 Auto Scaling and ECS Fargate behind an ALB, with a load-test workflow that records scaling. | [Source](https://github.com/zeinhaidara/aws-3-tier-github-actions) |
| **GitHub to AWS pipeline** | Scanned changes promoted through dev, stage, and main to S3 over OIDC. | [Source](https://github.com/zeinhaidara/github-to-aws-pipeline) |
| **Northbridge Health (Azure)** | Referral-platform blueprint: Terraform modules, AKS, private endpoints, workload identity, Key Vault. Resilience evidence in progress. | [Source](https://github.com/zeinhaidara/azure-endtoend-platform) |

Demo environments are torn down after capture to control cost, so each case study keeps its screenshots and write-up. Orbital Expeditions is a fictional storefront used as a realistic workload.

## About this site

A static site on GitHub Pages with no build step. The homepage is a 3D world (Three.js) where each project is a floating island, viewable by day or by night.

| File | Purpose |
|---|---|
| `index.html`, `app.css`, `app.js` | Homepage: project panel, day/night switch, flat fallback for devices without WebGL |
| `world.js` | 3D island world for both day and night |
| `healthcare.html`, `pipeline.js` | Healthcare SecOps case study and pipeline simulator |
| `orbital.html`, `style.css` | Orbital Expeditions case study and shared case-study styles |
| `classic.html` | Plain project list for non-3D use |
| `assets/`, `og-image.png` | Screenshots and social preview |

Local preview only: serve the folder with `python -m http.server` and open `http://localhost:8000`. The live site needs no setup.
