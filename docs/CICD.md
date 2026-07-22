# CI/CD — auto-deploy to the Lightsail server

Pushing to **`master`** automatically redeploys the running container on the
AWS Lightsail host. No manual SSH needed.

## How it works

```
git push origin master
        │
        ▼
GitHub Actions queues the "Deploy to Lightsail" workflow
        │  (self-hosted runner on the server polls GitHub, outbound only)
        ▼
Runner on 34.235.45.157 executes .github/workflows/deploy.yml:
   git reset --hard origin/master      # update code
   docker compose up -d --build app    # rebuild + restart the app container
   curl http://127.0.0.1:5000/         # health check (fails the run if not 200)
```

The runner lives **on the server**, so:

- **No inbound ports** are opened — SSH stays locked to the owner's IP.
- The runner connects **outbound** to GitHub and runs the deploy locally.

## What is (and isn't) touched by a deploy

- **Updated:** all git-tracked code (server.js, routes, views, Dockerfile, …).
- **Left alone:** `.env`, `Caddyfile`, `docker-compose.override.yml`, and the
  `data/` (SQLite DB) + `public/uploads/` dirs — they are gitignored/untracked,
  so `git reset --hard` never removes them.
- Caddy and ngrok containers are not rebuilt; only the `app` image is.

## Triggering a deploy

- **Automatic:** any push to `master`.
- **Manual:** Actions tab → "Deploy to Lightsail" → **Run workflow**.

## The self-hosted runner

Installed under `/home/ubuntu/actions-runner` as a **systemd service**
(`actions.runner.*`), labelled `self-hosted, lacheshirehomes`. It survives
reboots. The deploy steps use `sudo` (the `ubuntu` user has passwordless sudo)
because the app lives in root-owned `/opt/lacheshirehomes`.

Useful commands (SSH in as `ubuntu`):

```bash
sudo systemctl status  'actions.runner.*'     # runner health
cd /home/ubuntu/actions-runner && sudo ./svc.sh status
```

## Git auth on the server

`origin` uses a **read-only SSH deploy key** (`~/.ssh/deploy_key` for root) so
the earlier embedded HTTPS token can be revoked. The key is registered as a
read-only Deploy Key on the GitHub repo.

## Rolling back

Push a revert commit (it redeploys automatically), or SSH in and:

```bash
sudo git -C /opt/lacheshirehomes reset --hard <good-commit>
cd /opt/lacheshirehomes && sudo docker compose up -d --build app
```
