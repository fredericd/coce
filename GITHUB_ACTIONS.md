# GitHub Actions Workflows

This repository includes several GitHub Actions workflows for automated CI/CD and security.

## Workflows

### 1. Docker Build and Push (`docker-build.yml`)

**Triggers:**
- When you push a tag starting with `v` (e.g., `v1.2.0`)
- Manual trigger via workflow dispatch

**What it does:**
- Builds Docker image for multiple architectures (amd64, arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Creates multiple tags: exact version, major.minor, major, and latest
- Uses reliable variable parsing patterns from Koha plugin workflows
- Provides detailed build summaries

**Usage:**
```bash
# Create and push a tag to trigger the build
git tag v1.2.0
git push origin v1.2.0
```

**Image will be available at:**
- `ghcr.io/yourusername/coce:v1.2.0`
- `ghcr.io/yourusername/coce:1.2`
- `ghcr.io/yourusername/coce:1`
- `ghcr.io/yourusername/coce:latest`

### 2. Continuous Integration (`ci.yml`)

**Triggers:**
- Push to master/main branch
- Pull requests to master/main branch

**What it does:**
- Tests on multiple Node.js versions (16, 18, 20)
- Runs with Redis service
- Executes linting and tests
- Builds and tests Docker image
- Validates docker-compose setup

### 3. Security Scanning (`security.yml`)

**Triggers:**
- Push to master/main branch
- Pull requests to master/main branch
- Weekly schedule (Mondays at 6 AM UTC)

**What it does:**
- Scans npm dependencies for vulnerabilities
- Scans Docker image with Trivy
- Uploads security results to GitHub Security tab

## Setup Requirements

### For Docker Registry Push

The workflows use GitHub Container Registry (ghcr.io) which requires:

1. **Package permissions**: The workflow has `packages: write` permission
2. **Repository settings**: 
   - Go to Settings → Actions → General
   - Ensure "Read and write permissions" is selected for GITHUB_TOKEN

### For Security Scanning

No additional setup required - uses built-in GitHub security features.

## Using the Built Images

Once a tag is pushed and the workflow completes:

```bash
# Pull the image
docker pull ghcr.io/yourusername/coce:latest

# Or use in docker-compose
# Update docker-compose.yml to use the registry image instead of building locally
```

## Customization

### Change Registry

To use Docker Hub instead of GitHub Container Registry:

1. Edit `docker-build.yml`
2. Change `REGISTRY` to `docker.io`
3. Add Docker Hub credentials as repository secrets:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

### Add More Tests

Edit `ci.yml` to add more test steps:
- Integration tests
- Performance tests
- API endpoint tests

### Modify Security Policies

Edit `security.yml` to:
- Change vulnerability severity levels
- Add additional security scanners
- Modify scan frequency
