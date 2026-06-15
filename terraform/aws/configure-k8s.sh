#!/bin/bash
# Nestarr AWS Kubernetes Configuration Helper
# This script helps configure the Kubernetes manifests with values from Terraform outputs

set -euo pipefail

# Check if we're in the terraform/aws directory or navigate there
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}"
K8S_AWS_DIR="${SCRIPT_DIR}/../../k8s/overlays/aws"

# Check if terraform is available
if ! command -v terraform &> /dev/null; then
    echo "Error: terraform is not installed or not in PATH"
    exit 1
fi

# Check if we're in an initialized terraform directory
if [ ! -d "${TERRAFORM_DIR}/.terraform" ]; then
    echo "Error: Terraform has not been initialized. Run 'terraform init' first."
    exit 1
fi

echo "Extracting values from Terraform outputs..."

# Get Terraform outputs
RDS_ENDPOINT=$(terraform -chdir="${TERRAFORM_DIR}" output -raw rds_address 2>/dev/null) || {
    echo "Error: Could not get RDS address. Make sure 'terraform apply' has been run."
    exit 1
}

S3_BUCKET=$(terraform -chdir="${TERRAFORM_DIR}" output -raw s3_bucket_name 2>/dev/null) || {
    echo "Error: Could not get S3 bucket name. Make sure 'terraform apply' has been run."
    exit 1
}

S3_ROLE_ARN=$(terraform -chdir="${TERRAFORM_DIR}" output -raw nestarr_s3_role_arn 2>/dev/null) || {
    echo "Error: Could not get S3 role ARN. Make sure 'terraform apply' has been run."
    exit 1
}

echo ""
echo "=== Terraform Output Values ==="
echo "RDS Endpoint:  ${RDS_ENDPOINT}"
echo "S3 Bucket:     ${S3_BUCKET}"
echo "S3 Role ARN:   ${S3_ROLE_ARN}"
echo ""

# Check if K8s overlay directory exists
if [ ! -d "${K8S_AWS_DIR}" ]; then
    echo "Error: Kubernetes AWS overlay directory not found at ${K8S_AWS_DIR}"
    exit 1
fi

echo "=== Kubernetes Configuration Instructions ==="
echo ""
echo "1. Update k8s/overlays/aws/kustomization.yaml:"
echo "   Replace '<your-rds-endpoint>.us-east-1.rds.amazonaws.com' with:"
echo "   ${RDS_ENDPOINT}"
echo ""
echo "   Replace '<your-s3-bucket>' with:"
echo "   ${S3_BUCKET}"
echo ""
echo "2. Update k8s/overlays/aws/service-account.yaml:"
echo "   Replace the eks.amazonaws.com/role-arn annotation with:"
echo "   ${S3_ROLE_ARN}"
echo ""
echo "3. Apply the Kubernetes configuration:"
echo "   kubectl apply -k k8s/overlays/aws"
echo ""

# Optionally auto-update files (prompt user)
read -p "Would you like to automatically update the Kubernetes configuration files? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Updating kustomization.yaml..."
    sed -i.bak "s|<your-rds-endpoint>\.us-east-1\.rds\.amazonaws\.com|${RDS_ENDPOINT}|g" "${K8S_AWS_DIR}/kustomization.yaml"
    sed -i.bak "s|<your-s3-bucket>|${S3_BUCKET}|g" "${K8S_AWS_DIR}/kustomization.yaml"
    
    echo "Updating service-account.yaml..."
    sed -i.bak "s|arn:aws:iam::<your-account-id>:role/nestarr-s3-access-role|${S3_ROLE_ARN}|g" "${K8S_AWS_DIR}/service-account.yaml"
    
    # Clean up backup files
    rm -f "${K8S_AWS_DIR}/kustomization.yaml.bak" "${K8S_AWS_DIR}/service-account.yaml.bak"
    
    echo ""
    echo "Configuration files updated successfully!"
    echo "You can now apply the configuration with:"
    echo "  kubectl apply -k k8s/overlays/aws"
else
    echo "Files not modified. Please update them manually with the values above."
fi
