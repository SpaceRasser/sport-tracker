# Deployment (VPS Ubuntu 24.04 + Docker)

## Prerequisites
- Docker Engine + Docker Compose plugin installed on the server.

## Commands
```bash
git clone <repo-url> sport-tracker
cd sport-tracker
cp infra/.env.prod.example infra/.env.prod
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

## Health check
```bash
curl -i http://<server-ip>/health
curl -i http://<server-ip>/api/health
```
