# AI Task Processing Platform

[![CI/CD Pipeline](https://github.com/yuankraj/ai-task-infra/actions/workflows/ci.yml/badge.svg)](https://github.com/yuankraj/ai-task-infra/actions/workflows/ci.yml)
![Kubernetes](https://img.shields.io/badge/Kubernetes-ready-blue?logo=kubernetes)
![Docker](https://img.shields.io/badge/Docker-containerized-blue?logo=docker)
![ArgoCD](https://img.shields.io/badge/ArgoCD-GitOps-orange?logo=argocd)

A production-ready, distributed AI text processing platform built on the MERN stack with Python worker services, orchestrated via Kubernetes and deployed through a robust GitOps pipeline.

---

## ✨ Key Features
*   **Real-time Task Tracking**: Modern Glassmorphism dashboard with 4-state status indicators.
*   **Asynchronous Processing**: Decoupled Node.js API and Python Worker pool via Redis.
*   **High Performance**: Designed to handle 100k+ tasks/day with sub-second response times.
*   **Automated GitOps**: Continuous Deployment using Argo CD and GitHub Actions.
*   **Auto-scaling**: Kubernetes HPA dynamically scales worker replicas based on load.

---

## 🛠️ Technology Stack
*   **Frontend**: React.js, Vite, Vanilla CSS (Premium Design System)
*   **Backend**: Node.js, Express, JWT Auth
*   **Worker**: Python 3.10
*   **Caching/Queue**: Redis (Bull)
*   **Database**: MongoDB (Mongoose)
*   **Infrastructure**: Kubernetes, Kustomize, Argo CD, Docker

---

## 🏗️ Getting Started

### 1. Local Development (Docker Compose)
Ideal for testing features without a Kubernetes overhead.
```bash
git clone https://github.com/yuankraj/ai-task-infra.git
cd ai-task-platform
docker-compose up -d --build
```
Access at: `http://localhost:3000`

### 2. Kubernetes Deployment (GitOps)
This project follows a strict GitOps paradigm using Argo CD.

1.  **Install Argo CD** into your cluster:
    ```bash
    kubectl create namespace argocd
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    ```
2.  **Apply Application Manifest**:
    ```bash
    kubectl apply -f infra/argocd/applications.yaml
    ```

---

## 📘 Documentation
Detailed technical documentation is available in the following files:
*   [Architecture Deep-Dive](Architecture.md): System design, scaling strategies, and sequence diagrams.
*   [API Reference](backend/README.md): Endpoint documentation and authentication flows.
*   [Worker Logic](worker/README.md): Details on Python processing modules.

---

## 🚀 Deployment Workflow
1.  **Push code** to `master`.
2.  **GitHub Actions** runs linting, builds Docker images, and pushes to DockerHub.
3.  **CI update**: The action automatically commits the updated image tag to the `k8s/base` manifests.
4.  **Argo CD** detects the change and performs a zero-downtime rolling update across the cluster.

---

## 📞 Contact
**Vishal [Your Surname]**
- LinkedIn: [Your Profile]
- Portfolio: [Your Website]
