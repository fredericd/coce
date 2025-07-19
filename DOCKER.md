# Docker Setup for Coce

## Quick Start

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Test the service:**
   ```bash
   curl "http://localhost:8080/cover?id=9780415480635&provider=gb,aws,ol"
   ```

## Configuration

The Docker container generates its configuration from environment variables at startup. No config.json file is needed!

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key variables:
- `COCE_PORT` - Server port (default: 8080)
- `COCE_PROVIDERS` - Comma-separated list of providers (default: gb,aws,ol)
- `REDIS_HOST` - Redis hostname (default: redis)
- `COCE_CACHE_PATH` - Local cache directory (default: /app/covers)
- `COCE_ORB_USER` / `COCE_ORB_KEY` - ORB credentials (optional)

See `.env.example` for all available options.

## Services

- **coce**: The main application (port 8080)
- **redis**: Redis cache server (port 6379)

## Volumes

- `redis_data`: Persistent Redis data
- `coce_covers`: Cached cover images

## Development

To rebuild after code changes:
```bash
docker-compose up --build
```

To view logs:
```bash
docker-compose logs -f coce
```

To stop services:
```bash
docker-compose down
```

To stop and remove volumes:
```bash
docker-compose down -v
```

## Production Deployment

For production, override environment variables:

```bash
# Using environment file
docker-compose --env-file .env.prod up -d

# Or set variables directly
COCE_PROVIDERS=gb,aws,ol,orb \
COCE_ORB_USER=myuser \
COCE_ORB_KEY=mykey \
docker-compose up -d
```
