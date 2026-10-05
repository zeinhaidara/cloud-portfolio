# Cloud Portfolio

Source for my cloud engineering portfolio, published with GitHub Pages.

**Live site:** https://zeinhaidara.github.io/cloud-portfolio/

## What this repo is

A static, dependency-free website (plain HTML and CSS) that presents my cloud and DevOps projects as case studies, with architecture diagrams and evidence captured from the running systems. Demo infrastructure is torn down to control cost, so each project keeps its screenshots and write-up here instead.

## Projects

- **Orbital Expeditions** ([case study](https://zeinhaidara.github.io/cloud-portfolio/orbital.html)): six microservices on AWS EKS with an event-driven order flow, Terraform and Helm delivery, and a Prometheus and Grafana operations dashboard. Source: [aws-retail-microservices-eks](https://github.com/zeinhaidara/aws-retail-microservices-eks).
- **AWS three-tier delivery**: [aws-3-tier-github-actions](https://github.com/zeinhaidara/aws-3-tier-github-actions)
- **GitHub to AWS pipeline**: [github-to-aws-pipeline](https://github.com/zeinhaidara/github-to-aws-pipeline)
- **Northbridge Health (Azure)**: [azure-endtoend-platform](https://github.com/zeinhaidara/azure-endtoend-platform)

More case studies will be added as new projects are completed.

## Structure

```
index.html     Home page: overview and project cards
orbital.html   Orbital Expeditions case study
style.css      Shared styles
assets/        Screenshots and captures used by the pages
```

To add a project, copy `orbital.html`, keep the same sections (overview, architecture, evidence), save its screenshots in `assets/`, and add a card to `index.html`.

## Run locally

Open `index.html` in a browser. No build step is required.
