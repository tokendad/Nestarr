# Nestarr AWS Infrastructure
# Variable definitions

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string
  default     = "nestarr"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# VPC Variables
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# EKS Variables
variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster. Check AWS documentation for supported versions: https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for EKS node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_desired_size" {
  description = "Desired number of nodes in the EKS node group"
  type        = number
  default     = 2
}

variable "eks_min_size" {
  description = "Minimum number of nodes in the EKS node group"
  type        = number
  default     = 1
}

variable "eks_max_size" {
  description = "Maximum number of nodes in the EKS node group"
  type        = number
  default     = 5
}

variable "eks_node_disk_size" {
  description = "Disk size in GB for EKS nodes"
  type        = number
  default     = 50
}

# RDS Variables
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage for RDS autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "nestarr"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "nestarr"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = false
}

variable "db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

# S3 Variables
variable "s3_force_destroy" {
  description = "Allow Terraform to destroy the S3 bucket even if it contains objects"
  type        = bool
  default     = false
}

variable "s3_versioning_enabled" {
  description = "Enable versioning for the S3 bucket"
  type        = bool
  default     = true
}

variable "s3_cors_allowed_origins" {
  description = "List of allowed origins for CORS. Use ['*'] for development, specific domains for production."
  type        = list(string)
  default     = ["*"]
}
