# Terraform — AWS Lightsail deployment

Provisions a Lightsail instance for the LA Cheshire Homes app with:

- **Docker + Compose** installed via cloud-init
- A **persistent block disk** mounted at `/opt/lacheshirehomes` for the SQLite DB
  and uploaded media (survives instance rebuilds)
- A **static public IP**
- A **firewall** opening 80/443 (web) and 22 (SSH, lockable to your IP)
- Optional **auto-deploy** from your git repo on first boot

## Why a VM (not App Runner / Fargate)?

The app writes SQLite and uploaded files to the local filesystem. Lightsail with an
attached block disk gives real persistent storage; AWS's managed container services
are ephemeral (App Runner) or NFS-only (Fargate/EFS, which SQLite dislikes).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.5
- AWS credentials configured (`aws configure`, or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars)

## Usage

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # then edit it
terraform init
terraform plan
terraform apply
```

Outputs give you the public IP, app URL, and an SSH command.

### Verify the plan/bundle IDs first

Bundle IDs and prices change by region:

```bash
aws lightsail get-bundles  --query 'bundles[].{id:bundleId,price:price,ram:ramSizeInGb}'
aws lightsail get-blueprints --query 'blueprints[?platform==`LINUX_UNIX`].blueprintId'
```

`nano_3_0` is the cheapest (~$5, 512MB) but tight for `docker build`; `micro_3_0`
(1GB) is the safe default.

## Deploying the app

**Option 1 — auto-deploy (set `repo_url`).** cloud-init clones the repo onto the
persistent disk and runs `docker compose up -d --build`, publishing on port 80.
For a private repo use a token URL:

```hcl
repo_url = "https://<TOKEN>@github.com/masoodmaz/LACheshireHomes.git"
```

**Option 2 — manual.** Leave `repo_url` empty (only Docker gets installed), then:

```bash
ssh -i /path/to/key.pem ubuntu@<public_ip>
git clone <your repo> /opt/lacheshirehomes && cd /opt/lacheshirehomes
cp .env.example .env && nano .env          # set real secrets
printf 'services:\n  app:\n    ports:\n      - "80:5000"\n' > docker-compose.override.yml
docker compose up -d --build
```

## ⚠️ Secrets

`.env` is **not** in git. On first boot the script copies `.env.example` → `.env`
so the container starts, but you must SSH in and set real values
(`SESSION_SECRET`, email creds, admin login) before going live.

## TLS / custom domain

1. Point your domain's **A record** at the `public_ip` output.
2. Add a reverse proxy for HTTPS — e.g. run Caddy in front of the app (auto Let's
   Encrypt), or use nginx + certbot. Ports 443/80 are already open.

## Teardown

```bash
terraform destroy
```

This deletes the instance **and the data disk** — back up `/opt/lacheshirehomes`
first if you need the DB or uploads.

---

### Prefer EC2 instead of Lightsail?

The same design maps to `aws_instance` + `aws_ebs_volume` +
`aws_volume_attachment` + a security group, reusing this exact `user_data` script.
Ask and I'll generate that variant (adds the 12-month free-tier `t3.micro` option).
