# Nestarr Kubernetes Deployment

This directory contains Kubernetes manifests for deploying Nestarr with a highly available PostgreSQL database and auto-scaling capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
│                                                                 │
│  ┌──────────────┐                                               │
│  │   Ingress    │────────────────────────────────┐              │
│  └──────────────┘                                │              │
│         │                                        │              │
│         ▼                                        ▼              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Nestarr Deployment (HPA)               │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │     │
│  │  │  Pod 1   │ │  Pod 2   │ │  Pod N   │   (2-10+)   │     │
│  │  └──────────┘ └──────────┘ └──────────┘              │     │
│  └────────────────────────────────────────────────────────┘     │
│         │                                                       │
│         ▼                                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │           PostgreSQL HA StatefulSet (3 replicas)       │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │     │
│  │  │Primary/  │ │ Replica  │ │ Replica  │              │     │
│  │  │ Pod 0    │ │  Pod 1   │ │  Pod 2   │              │     │
│  │  └──────────┘ └──────────┘ └──────────┘              │     │
│  └────────────────────────────────────────────────────────┘     │
│         │                                                       │
│         ▼                                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Persistent Volume Claims                   │     │
│  │  ┌───────────────┐  ┌───────────────────────────────┐  │     │
│  │  │ Media Storage │  │ PostgreSQL Data (per replica) │  │     │
│  │  │   (RWX)       │  │         (RWO)                 │  │     │
│  │  └───────────────┘  └───────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **High Availability Database**: PostgreSQL StatefulSet with 3 replicas
- **Auto-scaling**: HorizontalPodAutoscaler scales Nestarr pods based on CPU/memory usage
- **Pod Disruption Budgets**: Ensures minimum availability during maintenance
- **Network Policies**: Restricts traffic to necessary communications only
- **Persistent Storage**: Separate PVCs for media files and database data
- **Security**: Non-root containers, dropped capabilities, read-only where possible
- **Kustomize Overlays**: Separate configurations for development and production

## Rename Upgrade Caution

The manifests now use `nestarr` for namespaces, labels, services, secrets, PVCs,
and image names. Applying these manifests to a live cluster that still uses
NesVentory resource names can create new resources instead of migrating existing
ones. Back up persistent volumes and secrets first, then plan explicit `kubectl`
copy/rename steps for live data before switching traffic.

## Directory Structure

```
k8s/
├── base/                    # Base manifests
│   ├── namespace.yaml       # Namespace definition
│   ├── configmap.yaml       # Application configuration
│   ├── secrets.yaml         # Sensitive data (CHANGE BEFORE USE!)
│   ├── storage.yaml         # PersistentVolumeClaims
│   ├── postgres.yaml        # PostgreSQL HA StatefulSet
│   ├── deployment.yaml      # Nestarr Deployment & Service
│   ├── hpa.yaml             # HorizontalPodAutoscaler
│   ├── ingress.yaml         # Ingress configuration
│   ├── network-policy.yaml  # Network policies
│   ├── pdb.yaml             # Pod Disruption Budgets
│   └── kustomization.yaml   # Kustomize base configuration
└── overlays/
    ├── development/         # Development-specific overrides
    │   └── kustomization.yaml
    ├── production/          # Production-specific overrides
    │   └── kustomization.yaml
    └── aws/                 # AWS EKS-specific overrides
        ├── kustomization.yaml
        └── service-account.yaml  # IRSA service account
```

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured for your cluster
- Storage class that supports ReadWriteOnce (for PostgreSQL) and ReadWriteMany (for shared media)
- Ingress controller (nginx-ingress recommended)
- Optional: cert-manager for TLS certificates

## Quick Start

### 1. Update Secrets

**CRITICAL**: Before deploying, update the secrets in `base/secrets.yaml`:

```bash
# Generate secure keys
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Edit secrets.yaml with your generated values
nano k8s/base/secrets.yaml
```

Required secrets to change:
- `SECRET_KEY` - Application secret key
- `JWT_SECRET_KEY` - JWT signing key
- `DB_PASSWORD` - Database password
- `POSTGRES_PASSWORD` - PostgreSQL superuser password

### 2. Configure Ingress

Update `base/ingress.yaml` with your domain:

```yaml
spec:
  rules:
    - host: your-domain.example.com  # Change this
```

### 3. Deploy

#### Development Environment

```bash
# Apply development configuration
kubectl apply -k k8s/overlays/development

# Watch deployment progress
kubectl -n nestarr get pods -w
```

#### Production Environment

```bash
# Apply production configuration
kubectl apply -k k8s/overlays/production

# Watch deployment progress
kubectl -n nestarr get pods -w
```

#### AWS EKS Environment

For AWS EKS deployment with RDS and S3, see the [Terraform AWS documentation](../terraform/aws/README.md) first.

After deploying the infrastructure with Terraform:

1. Update the AWS overlay configuration:
   ```bash
   # Edit k8s/overlays/aws/kustomization.yaml
   # Update DB_HOST with your RDS endpoint
   # Update S3_BUCKET_NAME with your bucket name
   
   # Edit k8s/overlays/aws/service-account.yaml
   # Update the IAM role ARN from Terraform output
   ```

2. Apply the AWS configuration:
   ```bash
   # Apply AWS-specific configuration
   kubectl apply -k k8s/overlays/aws
   
   # Watch deployment progress
   kubectl -n nestarr get pods -w
   ```

### 4. Verify Deployment

```bash
# Check all resources
kubectl -n nestarr get all

# Check pods are running
kubectl -n nestarr get pods

# Check HPA status
kubectl -n nestarr get hpa

# View logs
kubectl -n nestarr logs -l app=nestarr -f
```

## Configuration

### Environment Variables

Configuration is managed through:

1. **ConfigMap** (`configmap.yaml`): Non-sensitive configuration
   - `PROJECT_NAME`, `APP_PORT`, `TZ`
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`
   - `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
   - `GEMINI_MODEL`, `GEMINI_REQUEST_DELAY`
   - `CORS_ORIGINS`

2. **Secrets** (`secrets.yaml`): Sensitive data
   - `SECRET_KEY`, `JWT_SECRET_KEY`
   - `DB_PASSWORD`
   - `GEMINI_API_KEY` (optional)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional)

### Auto-scaling Configuration

The HPA is configured with:
- **Min replicas**: 2 (production: 3)
- **Max replicas**: 10 (production: 20)
- **Scale up trigger**: CPU > 70% or Memory > 80%
- **Scale down stabilization**: 5 minutes

Modify `base/hpa.yaml` to adjust these values.

### Storage

Default storage requests:
- PostgreSQL: 20Gi per replica
- Media files: 10Gi (shared)

Uncomment and set `storageClassName` in `storage.yaml` if your cluster requires a specific storage class.

## Operations

### Scaling Manually

```bash
# Scale Nestarr deployment
kubectl -n nestarr scale deployment nestarr --replicas=5

# Note: HPA will override manual scaling based on metrics
```

### Database Access

```bash
# Connect to PostgreSQL
kubectl -n nestarr exec -it postgres-ha-0 -- psql -U nestarr -d nestarr
```

### Backup Database

```bash
# Create a backup
kubectl -n nestarr exec postgres-ha-0 -- pg_dump -U nestarr nestarr > backup.sql
```

### View Logs

```bash
# Application logs
kubectl -n nestarr logs -l app=nestarr -f

# PostgreSQL logs
kubectl -n nestarr logs -l app=postgres-ha -f
```

### Upgrade Application

```bash
# Update image and rollout
kubectl -n nestarr set image deployment/nestarr \
  nestarr=ghcr.io/tokendad/nestarr:v4.3.0

# Monitor rollout
kubectl -n nestarr rollout status deployment/nestarr
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod events
kubectl -n nestarr describe pod <pod-name>

# Check pod logs
kubectl -n nestarr logs <pod-name>
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
kubectl -n nestarr get pods -l app=postgres-ha

# Check PostgreSQL logs
kubectl -n nestarr logs postgres-ha-0

# Test database connectivity from app pod
kubectl -n nestarr exec -it <nestarr-pod> -- nc -zv postgres-ha 5432
```

### HPA Not Scaling

```bash
# Check HPA status
kubectl -n nestarr describe hpa nestarr-hpa

# Verify metrics-server is running
kubectl -n kube-system get pods -l k8s-app=metrics-server
```

## Security Considerations

1. **Secrets Management**: Consider using external secrets management (HashiCorp Vault, AWS Secrets Manager, etc.)
2. **Network Policies**: Review and adjust based on your security requirements
3. **TLS**: Enable TLS in ingress for production deployments
4. **RBAC**: Apply principle of least privilege for service accounts
5. **Image Scanning**: Regularly scan container images for vulnerabilities

## Migration from SQLite

If migrating from a SQLite-based deployment:

1. Export data from SQLite database
2. Deploy PostgreSQL using these manifests
3. Import data into PostgreSQL
4. Update application to use PostgreSQL connection string
5. Verify data integrity

## Support

For issues with:
- **Application**: Check [Nestarr GitHub Issues](https://github.com/tokendad/Nestarr/issues)
- **Kubernetes**: Refer to [Kubernetes documentation](https://kubernetes.io/docs/)
