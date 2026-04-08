# AI Task Processing Platform: Complete Setup Guide

This guide provides step-by-step instructions to set up the entire architecture from scratch, including local development via Docker, and production-like deployment using Kubernetes, GitOps (Argo CD), and CI/CD (GitHub Actions).

---

## 🏗️ 1. Local Development (Docker Compose)

For local testing without Kubernetes, use Docker Compose.

**Prerequisites:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine.

**1. Clone the Application Repository:**
```bash
git clone <YOUR_APP_REPO_URL>
cd ai-task-platform
```

**2. Start the Stack System:**
```bash
docker-compose up -d --build
```
*This starts MongoDB, Redis, the Node.js Backend API, the Python Worker, and the React Frontend.*

**3. Verify Local Services:**
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API Health: [http://localhost:5000/health](http://localhost:5000/health)

**4. Stop the Environment:**
```bash
docker-compose down
```

---

## 🌐 2. Kubernetes Cluster Setup (K3s / Kind)

For deploying the production-grade GitOps architecture, you need a Kubernetes cluster. We will use `kind` (Kubernetes in Docker) for this example, but `k3s` or `minikube` work identically.

**Prerequisites:** Install `kubectl` and `kind`.

**1. Create the Local Cluster:**
```bash
kind create cluster --name ai-platform
```

**2. Verify Cluster Connection:**
```bash
kubectl cluster-info --context kind-ai-platform
```

**3. Create the Application Namespace:**
```bash
kubectl create namespace ai-task-platform
kubectl create namespace ai-task-platform-prod
```

**4. Deploy Secrets manually (Simulating a Secret Manager):**
```bash
kubectl create secret generic app-secrets \
  --namespace ai-task-platform \
  --from-literal=JWT_SECRET="dev_secret_key_123" \
  --from-literal=JWT_REFRESH_SECRET="dev_refresh_key_123" \
  --from-literal=REDIS_PASSWORD=""

kubectl create secret generic app-secrets \
  --namespace ai-task-platform-prod \
  --from-literal=JWT_SECRET="prod_secret_key_456" \
  --from-literal=JWT_REFRESH_SECRET="prod_refresh_key_456" \
  --from-literal=REDIS_PASSWORD=""
```

---

## 🔄 3. GitOps Setup (Infrastructure Repo)

GitOps dictates that all infrastructure manifest changes live in their own repository.

**1. Create a New Git Repository:**
Create a new blank repository on GitHub named `ai-task-infra`.

**2. Port Manifests to Infra Repo:**
Copy the files located in our application's `k8s/` and `infra/` folders directly into this new `ai-task-infra` repository, commit, and push them.

```bash
# Assuming you cloned your new infra repo locally next to the app repo
cp -R ../ai-task-platform/k8s ./k8s
cp -R ../ai-task-platform/infra ./infra
git add .
git commit -m "Initial infra structure"
git push origin main
```

---

## 🐙 4. Argo CD Installation & Configuration

Argo CD will automatically sync our `ai-task-infra` repository into the Kubernetes cluster.

**1. Install Argo CD to the Cluster:**
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

**2. Access the Argo CD UI (Port Forwarding):**
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
*Argo CD is now available at `https://localhost:8080`*

**3. Get the initial Admin Password:**
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```
*Login username: `admin`*

**4. Deploy our Applications using Argo CD:**
Make sure you update the `repoURL` in `infra/argocd/applications.yaml` to point to YOUR newly created `ai-task-infra` repository URL before running this:

```bash
# Run this from your downloaded app directory
kubectl apply -f infra/argocd/applications.yaml
```

Argo CD will instantly pick up the development and production specs, read the Kustomize manifests from your `ai-task-infra` repository, and begin spinning up MongoDB, Redis, the Node Backend, the Python Worker, and the Vite Frontend directly inside your cluster.

---

## 🚀 5. CI/CD GitHub Actions Setup

We want our application repository to automatically build new Docker images when code is pushed to `main`, and then automatically update our `ai-task-infra` repository with the new image tags.

**1. Configure Secrets in your Application Repository:**
Navigate to your App Repository on GitHub -> Settings -> Secrets and variables -> Actions.
Add the following secrets:
* `DOCKER_USERNAME`: Your DockerHub username (e.g. `cooldev123`)
* `DOCKER_PASSWORD`: Your DockerHub Access Token
* `INFRA_REPO_PAT`: A GitHub Personal Access Token (PAT) with `repo` scope. This allows the Action to write to your `ai-task-infra` repository.

**2. Update the CI Workflow variables:**
In your application repository, open `.github/workflows/ci.yml`.
Line 10 dictates the target infrastructure repo. Change it to match yours:
```yaml
env:
  INFRA_REPO: "your-github-username/ai-task-infra"
```

**3. Test the Automation:**
Make a change to any code file (e.g. `frontend/src/App.jsx`), commit, and push to `main`.
* GitHub Actions will run: linting the code, building Docker containers, and pushing them to DockerHub with a specific SHA tag.
* Next, GitHub Actions will seamlessly clone your `ai-task-infra` repo, replace the image tags in `k8s/base/*.yaml` with the newly built SHA tag, and push the commit.
* **Argo CD** will immediately detect the new commit on the `ai-task-infra` repository, visually show "OutOfSync", and automatically perform a Rolling Update replacing your old pods with the new images within seconds!

---

## 🔍 6. Verify and Interact with the Cluster

Once Argo CD has fully synced everything (all icons are green checkboxes in the UI), you can interact with the live deployed frontend using port forwarding.

**Port-forward the Frontend Service:**
```bash
kubectl port-forward svc/frontend-service -n ai-task-platform 3000:80
```
Open `http://localhost:3000` to see your GitOps deployed application!

**Checking Autoscaling (HPA):**
To ensure the Python worker scaler is properly registered:
```bash
kubectl get hpa -n ai-task-platform
```

You are now successfully running a complete Multi-Tier application heavily influenced by GitOps paradigms, Automated Build Pipelines, and Scalable Kubernetes architecture!
