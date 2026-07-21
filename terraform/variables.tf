variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "availability_zone" {
  description = "Availability zone for the instance and its data disk. Must be in aws_region."
  type        = string
  default     = "us-east-1a"
}

variable "instance_name" {
  description = "Name for the Lightsail instance."
  type        = string
  default     = "lacheshirehomes"
}

variable "blueprint_id" {
  description = "OS blueprint. Verify with: aws lightsail get-blueprints --query 'blueprints[].blueprintId'"
  type        = string
  default     = "ubuntu_22_04"
}

variable "bundle_id" {
  description = <<-EOT
    Instance size/plan. Verify current IDs + prices with:
      aws lightsail get-bundles --query 'bundles[].{id:bundleId,price:price,ram:ramSizeInGb}'
    nano_3_0  = 512MB (cheapest, ~$5; may be tight for `docker build`)
    micro_3_0 = 1GB   (recommended — safe for building the image)
  EOT
  type        = string
  default     = "micro_3_0"
}

variable "data_disk_size_gb" {
  description = "Size of the persistent block disk that holds the SQLite DB and uploads."
  type        = number
  default     = 20
}

variable "repo_url" {
  description = <<-EOT
    Optional git URL of the app repo. If set, cloud-init clones it onto the
    persistent disk and runs `docker compose up`. Leave empty to only install
    Docker (you deploy the code manually). For a PRIVATE repo, embed a token,
    e.g. https://<token>@github.com/<user>/LACheshireHomes.git
  EOT
  type        = string
  default     = ""
}

variable "ssh_key_name" {
  description = <<-EOT
    Name of an existing Lightsail key pair to attach for SSH access.
    Leave empty to use Lightsail's auto-generated default key
    (download it from the Lightsail console > Account > SSH keys).
  EOT
  type        = string
  default     = ""
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to reach SSH (port 22). Lock this to your IP, e.g. 203.0.113.4/32."
  type        = string
  default     = "0.0.0.0/0"
}
