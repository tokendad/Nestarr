# Nestarr AWS Terraform Deployment

This directory contains Terraform configurations for deploying Nestarr to AWS with:
- Amazon EKS (Elastic Kubernetes Service) for container orchestration
- Amazon RDS (PostgreSQL) for database
- Amazon S3 for media storage
- Amazon ECR for container registry
- Application Load Balancer for ingress
- VPC with public and private subnets

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Account                                     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                            VPC (10.0.0.0/16)                           ││
│  │                                                                        ││
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────────┐ ││
│  │  │    Public Subnets           │  │    Private Subnets              │ ││
│  │  │    (10.0.0.0/24)            │  │    (10.0.10.0/24)               │ ││
│  │  │                             │  │                                 │ ││
│  │  │  ┌─────────────────────┐    │  │  ┌─────────────────────────┐   │ ││
│  │  │  │  Application Load   │    │  │  │    EKS Node Group       │   │ ││
│  │  │  │  Balancer (ALB)     │────┼──┼─▶│                         │   │ ││
│  │  │  │                     │    │  │  │  ┌─────────────────┐    │   │ ││
│  │  │  └─────────────────────┘    │  │  │  │ Nestarr Pods │    │   │ ││
│  │  │                             │  │  │  └─────────────────┘    │   │ ││
│  │  │  ┌─────────────────────┐    │  │  │                         │   │ ││
│  │  │  │     NAT Gateway     │    │  │  └─────────────────────────┘   │ ││
│  │  │  └─────────────────────┘    │  │                                 │ ││
│  │  │                             │  │  ┌─────────────────────────┐   │ ││
│  │  └─────────────────────────────┘  │  │    RDS PostgreSQL       │   │ ││
│  │                                   │  │    (Multi-AZ)           │   │ ││
│  │                                   │  └─────────────────────────┘   │ ││
│  │                                   │                                 │ ││
│  │                                   └─────────────────────────────────┘ ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │      S3          │  │      ECR         │  │   Secrets Manager        │  │
│  │  (Media Files)   │  │  (Container      │  │   (Credentials)          │  │
│  │                  │  │   Images)        │  │                          │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.0
3. **AWS CLI** configured with credentials
4. **kubectl** for managing the Kubernetes cluster
5. **Docker** for building and pushing container images

## Rename Upgrade Caution

Defaults now use the `nestarr` project, database, Kubernetes service account,
and IAM output names. For existing NesVentory Terraform state, do not apply the
rename blindly. Review `terraform plan` and move renamed IAM resources first:

```bash
terraform state mv aws_iam_role.nesventory_s3 aws_iam_role.nestarr_s3
terraform state mv aws_iam_policy.nesventory_s3 aws_iam_policy.nestarr_s3
terraform state mv aws_iam_role_policy_attachment.nesventory_s3 aws_iam_role_policy_attachment.nestarr_s3
```

Remote state bucket/table names in `main.tf` are examples. Rename or migrate
actual state storage only after taking a backup and updating backend config.

## Quick Start

### 1. Configure Variables

Copy the example variables file and customize it:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your settings:
- `project_name`: Name for the deployment (default: "nestarr")
- `aws_region`: AWS region to deploy to
- `environment`: Environment name (development, staging, production)
- `db_password`: Strong password for the database

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review the Plan

```bash
terraform plan
```

### 4. Apply the Configuration

```bash
terraform apply
```

### 5. Configure kubectl

After the deployment, configure kubectl to access the cluster:

```bash
aws eks update-kubeconfig --name nestarr-cluster --region <your-region>
```

### 6. Configure and Deploy the Application

Use the helper script to automatically configure Kubernetes manifests with Terraform outputs:

```bash
# Run the configuration helper script
./configure-k8s.sh
```

This script will:
- Extract values from Terraform outputs (RDS endpoint, S3 bucket, IAM role ARN)
- Optionally update the Kubernetes manifests automatically
- Provide instructions for manual configuration if preferred

Alternatively, manually apply the Kubernetes manifests:

```bash
# First, update k8s/overlays/aws/kustomization.yaml and service-account.yaml
# with values from terraform output
kubectl apply -k ../k8s/overlays/aws
```

## Components

### VPC (`vpc.tf`)
- VPC with DNS support
- Public subnets for ALB and NAT Gateway
- Private subnets for EKS nodes and RDS
- Internet Gateway and NAT Gateway
- Route tables for public and private subnets

### EKS Cluster (`eks.tf`)
- Managed Kubernetes control plane
- Node group with auto-scaling
- OIDC provider for IAM roles
- AWS Load Balancer Controller
- Cluster autoscaler

### RDS PostgreSQL (`rds.tf`)
- PostgreSQL 15 database
- Multi-AZ deployment for production
- Encrypted storage
- Private subnet placement
- Security group with EKS access

### S3 Bucket (`s3.tf`)
- Bucket for media file storage
- Server-side encryption
- Versioning enabled
- Lifecycle policies for cost optimization
- IAM role for EKS pod access (IRSA)

### ECR Repository (`ecr.tf`)
- Private container registry
- Image scanning on push
- Lifecycle policy for cleanup

### IAM Roles (`iam.tf`)
- EKS cluster role
- EKS node role
- S3 access role for pods (IRSA)

### Security Groups (`security-groups.tf`)
- EKS cluster security group
- EKS node security group
- RDS security group

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Name for the project | `nestarr` |
| `aws_region` | AWS region | `us-east-1` |
| `environment` | Environment name | `production` |
| `vpc_cidr` | VPC CIDR block | `10.0.0.0/16` |
| `eks_node_instance_types` | EC2 instance types for nodes | `["t3.medium"]` |
| `eks_desired_size` | Desired number of nodes | `2` |
| `eks_min_size` | Minimum number of nodes | `1` |
| `eks_max_size` | Maximum number of nodes | `5` |
| `db_instance_class` | RDS instance class | `db.t3.micro` |
| `db_allocated_storage` | RDS storage in GB | `20` |
| `db_password` | Database password | (required) |

## Outputs

After applying, Terraform will output:
- EKS cluster endpoint
- ECR repository URL
- S3 bucket name and ARN
- RDS endpoint
- VPC and subnet IDs

## Cost Optimization

For development/testing:
- Use smaller instance types
- Reduce node count
- Disable Multi-AZ for RDS
- Use t3.micro for RDS

For production:
- Enable Multi-AZ for RDS
- Use larger instance types
- Enable cluster autoscaler
- Consider reserved instances

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all resources including the S3 bucket and RDS database. Make sure to backup any important data first.

## Security Considerations

1. **Secrets**: Store sensitive values in AWS Secrets Manager or use Terraform Cloud
2. **Network**: RDS is placed in private subnets with no public access
3. **Encryption**: S3 and RDS use encryption at rest
4. **IAM**: Use IRSA for pod-level AWS access
5. **Updates**: Regularly update EKS and node AMIs

## Troubleshooting

### EKS Cluster Not Ready
```bash
aws eks describe-cluster --name nestarr-cluster --region <region>
```

### Node Group Issues
```bash
kubectl get nodes
kubectl describe node <node-name>
```

### RDS Connection Issues
- Check security group rules
- Verify subnet routing
- Check RDS instance status

### S3 Access Issues
- Verify IRSA configuration
- Check pod service account annotations
- Review IAM policy
