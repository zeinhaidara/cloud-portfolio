# M. Zein Haidara · Cloud Engineering

Senior Cloud Engineer focused on AWS, Azure, Kubernetes, and infrastructure automation.

**Portfolio:** https://zeinhaidara.github.io/cloud-portfolio/

Each project here is built the way production platforms are: infrastructure as code, least-privilege access, automated delivery, real monitoring, and load testing against a working environment. The site presents the architecture, the decisions behind it, and evidence captured from the running systems.

## Engineering approach

- **Infrastructure as code.** Terraform defines the platform; Helm, GitHub Actions, and Azure DevOps deliver it. Every change is reviewed and traceable to a commit.
- **Least privilege.** Scoped IAM roles and workload identity for runtime access, short-lived OIDC credentials for pipelines, and no long-lived keys.
- **Clear service boundaries.** Each service owns its data and rules, and consistency, caching, and eventing choices are documented.
- **Verified delivery.** Configuration validation, tests, security scans, immutable commit-tagged images, and post-deploy smoke checks.
- **Observability and load.** Prometheus, Grafana, and CloudWatch alarms for traffic, latency, and errors, plus load tests that exercise autoscaling end to end.

## Projects

### Orbital Expeditions: event-driven microservices on AWS EKS
[Case study](https://zeinhaidara.github.io/cloud-portfolio/orbital.html) · [Source](https://github.com/zeinhaidara/aws-retail-microservices-eks)

Six services on EKS with DynamoDB for atomic reservations, RDS MySQL with a transactional outbox, and Valkey for catalog caching. Order events move through EventBridge and SQS with a dead-letter queue. Terraform and Helm deliver the platform, and a Prometheus and Grafana dashboard tracks the services.

### AWS three-tier delivery
[Source](https://github.com/zeinhaidara/aws-3-tier-github-actions)

One FastAPI/MySQL application on two compute paths, EC2 Auto Scaling and ECS Fargate, behind an Application Load Balancer. Private subnets, Secrets Manager, immutable ECR images, and CloudWatch alarms, delivered with Terraform and GitHub Actions over OIDC. A load-test workflow drives sustained concurrent traffic at the HTTPS endpoint and records Auto Scaling capacity before and after.

### GitHub to AWS pipeline
[Source](https://github.com/zeinhaidara/github-to-aws-pipeline)

Tested, security-scanned changes promoted through dev, stage, and main to an S3 website, authenticated to AWS with OIDC.

### Northbridge Health on Azure
[Source](https://github.com/zeinhaidara/azure-endtoend-platform)

A referral-platform blueprint with reusable Terraform modules, AKS, private endpoints, workload identity, Key Vault, and staged delivery. Resilience and rebuild evidence is being added.

## Notes

Demo environments are torn down after capture to keep costs controlled, so each case study keeps its screenshots and write-up. Orbital Expeditions is a fictional storefront used as a realistic workload.

GitHub: [@zeinhaidara](https://github.com/zeinhaidara)
