########################################
# Lightsail instance
########################################
resource "aws_lightsail_instance" "app" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id

  # Only pass a key name when the user supplied one; otherwise Lightsail
  # uses the account's default key pair for this region.
  key_pair_name = var.ssh_key_name != "" ? var.ssh_key_name : null

  # cloud-init: install Docker, mount the persistent disk, optionally deploy.
  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    repo_url      = var.repo_url
    instance_name = var.instance_name
  })

  tags = {
    Project   = "LACheshireHomes"
    ManagedBy = "terraform"
  }
}

########################################
# Persistent block disk for DB + uploads
########################################
resource "aws_lightsail_disk" "data" {
  name              = "${var.instance_name}-data"
  availability_zone = var.availability_zone
  size_in_gb        = var.data_disk_size_gb

  tags = {
    Project   = "LACheshireHomes"
    ManagedBy = "terraform"
  }
}

resource "aws_lightsail_disk_attachment" "data" {
  disk_name     = aws_lightsail_disk.data.name
  instance_name = aws_lightsail_instance.app.name
  disk_path     = "/dev/xvdf"
}

########################################
# Static (stable) public IP
########################################
resource "aws_lightsail_static_ip" "app" {
  name = "${var.instance_name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.name
  instance_name  = aws_lightsail_instance.app.name
}

########################################
# Firewall — open web + SSH
########################################
resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  # HTTP
  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"]
  }

  # HTTPS (for when you add TLS / a reverse proxy)
  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"]
  }

  # SSH — restrict to your IP via allowed_ssh_cidr
  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = [var.allowed_ssh_cidr]
  }
}
