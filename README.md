# Zein Haidara: Cloud Engineering Portfolio

Senior Cloud Engineer, available for contract engagements in AWS, Azure, Kubernetes, and infrastructure automation.

**Portfolio site:** https://zeinhaidara.github.io/cloud-portfolio/

This repository is the source for the portfolio site. It documents how I design, build, deliver, and observe cloud platforms, using projects I built end to end. Each case study shows the architecture, the reasoning behind the key decisions, and evidence captured from the running system. Demo infrastructure is torn down to control cost, so the evidence is preserved here as captures.

## How I work

- **Infrastructure as code.** Platforms are defined in Terraform and deployed through Helm and GitHub Actions or Azure DevOps. Changes are reviewed, repeatable, and tied to commits.
- **Least privilege by default.** Workloads use scoped IAM roles or workload identity, pipelines authenticate with short-lived OIDC credentials rather than stored keys, and secrets are injected at deploy time.
- **Explicit service boundaries.** Each service owns its data and its rules. Consistency, caching, and eventing choices are made deliberately and documented.
- **Delivery with verification.** Pipelines validate configuration, run smoke tests and security checks, publish commit-tagged images, and confirm the deployment.
- **Observable systems.** Services expose metrics, Prometheus scrapes them, and Grafana dashboards cover traffic, latency, errors, and business flows.

## Featured case study

### Orbital Expeditions: event-driven microservices on AWS EKS
[Read the case study](https://zeinhaidara.github.io/cloud-portfolio/orbital.html) · [Source repository](https://github.com/zeinhaidara/aws-retail-microservices-eks)

Six services (storefront, product, inventory, order, trip planner, notification) on EKS. Highlights:

- DynamoDB for atomic seat reservations, RDS MySQL for orders and a transactional outbox, and Valkey for catalog caching without moving price authority away from the Product service.
- Order events flow from the outbox through EventBridge to SQS with a dead-letter queue, with at-least-once delivery and retries for the notification service.
- Provider credentials for the AI trip planner stay server-side; recommendations reference catalog items rather than inventing prices.
- Terraform for the platform, Helm for workloads, separate protected branches for application and infrastructure changes.
- Prometheus and Grafana operations dashboard, with captures from the running deployment.

## Other work

| Project | Focus |
| --- | --- |
| [AWS three-tier delivery](https://github.com/zeinhaidara/aws-3-tier-github-actions) | One FastAPI/MySQL application on two compute paths (private EC2 Auto Scaling and ECS Fargate behind an ALB), with Terraform and GitHub Actions publishing immutable images over OIDC. |
| [GitHub to AWS pipeline](https://github.com/zeinhaidara/github-to-aws-pipeline) | Tested and security-scanned changes promoted through dev, stage, and main to an S3 website, authenticated to AWS with OIDC. |
| [Northbridge Health (Azure)](https://github.com/zeinhaidara/azure-endtoend-platform) | Azure referral-platform blueprint with reusable Terraform modules, AKS, private endpoints, workload identity, Key Vault, and staged delivery. Resilience and rebuild evidence is still being added to the repository. |

## Scope and honesty

These are portfolio projects, not production systems for a client. The Orbital storefront is a fictional product built to exercise real engineering concerns, and the dashboard captures show a demo deployment with limited traffic, not production load. I note gaps where they exist rather than presenting them as finished.

## Contact

GitHub: [@zeinhaidara](https://github.com/zeinhaidara)
