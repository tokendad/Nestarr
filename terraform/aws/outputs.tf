# Nestarr AWS Infrastructure
# Terraform Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

# EKS Outputs
output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS cluster"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_certificate_authority" {
  description = "Certificate authority data for the EKS cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "eks_cluster_oidc_issuer" {
  description = "OIDC issuer URL for the EKS cluster"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role"
  value       = aws_iam_role.eks_node.arn
}

# RDS Outputs
output "rds_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "Address of the RDS instance"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "rds_database_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

# S3 Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for media storage"
  value       = aws_s3_bucket.media.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for media storage"
  value       = aws_s3_bucket.media.arn
}

output "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.media.bucket_regional_domain_name
}

# ECR Outputs
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.main.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.main.arn
}

# IAM Outputs
output "nestarr_s3_role_arn" {
  description = "ARN of the IAM role for Nestarr S3 access (IRSA)"
  value       = aws_iam_role.nestarr_s3.arn
}

output "nesventory_s3_role_arn" {
  description = "Deprecated compatibility output. Use nestarr_s3_role_arn."
  value       = aws_iam_role.nestarr_s3.arn
}

# kubectl configuration command
output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --name ${aws_eks_cluster.main.name} --region ${var.aws_region}"
}
