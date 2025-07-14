# PM2 Deployment Guide for Coce

This guide covers deploying Coce with PM2 for production environments.

## Quick Start

```bash
# Install PM2 globally
npm install -g pm2

# Start Coce with PM2
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs coce
```

## Production Deployment

### 1. Install Dependencies

```bash
# Install PM2
sudo npm install -g pm2

# Install Coce dependencies
npm install --production
```

### 2. Configure Environment

```bash
# Create log directory
sudo mkdir -p /var/log/coce
sudo chown $USER:$USER /var/log/coce

# Set environment variables
export NODE_ENV=production
export LOG_LEVEL=info
export LOG_FILE=/var/log/coce/coce.log
```

### 3. Start with PM2

```bash
# Start all instances
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup auto-startup
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

## PM2 Configuration Features

### Cluster Mode
- **Auto-scaling**: Uses all CPU cores (`instances: 'max'`)
- **Load balancing**: Distributes requests across instances
- **Zero-downtime**: Graceful restarts without service interruption

### Logging
- **Structured JSON**: All logs in JSON format for easy parsing
- **Log rotation**: Automatic log file rotation
- **Centralized logs**: Combined logs from all instances
- **Error separation**: Separate error logs for debugging

### Monitoring
- **Health checks**: `/health` endpoint for status monitoring
- **Metrics**: `/metrics` endpoint for performance data
- **Memory monitoring**: Auto-restart on memory threshold
- **Process monitoring**: Automatic restart on crashes

### Error Handling
- **Graceful shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Crash recovery**: Automatic restart with exponential backoff
- **Exception handling**: Structured error logging with context

## Monitoring Commands

```bash
# View process status
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs coce
pm2 logs coce --lines 100

# View specific instance logs
pm2 logs coce --instance 0

# Flush logs
pm2 flush

# Restart application
pm2 restart coce

# Reload (zero-downtime)
pm2 reload coce

# Stop application
pm2 stop coce

# Delete from PM2
pm2 delete coce
```

## Log Management

### Log Locations
- **Combined logs**: `/var/log/coce/combined.log`
- **Output logs**: `/var/log/coce/out.log`
- **Error logs**: `/var/log/coce/error.log`
- **Application logs**: `/var/log/coce/coce.log` (if LOG_FILE is set)

### Log Rotation
PM2 automatically rotates logs when they exceed size limits. Configure in `ecosystem.config.js`:

```javascript
max_memory_restart: '500M',  // Restart if memory exceeds 500MB
log_type: 'json',           // JSON format logs
merge_logs: true            // Merge logs from all instances
```

### Log Analysis
```bash
# Search for errors
pm2 logs coce | grep '"level":"error"'

# Monitor specific provider
pm2 logs coce | grep '"provider":"aws"'

# View performance metrics
pm2 logs coce | grep '"metrics"'
```

## Performance Optimization

### Memory Management
- **Memory monitoring**: Automatic restart at 500MB
- **Garbage collection**: Optimized for long-running processes
- **Memory leaks**: Structured logging helps identify leaks

### CPU Utilization
- **Cluster mode**: Utilizes all CPU cores
- **Load balancing**: Even distribution across instances
- **Non-blocking I/O**: Efficient handling of concurrent requests

### Caching
- **Redis integration**: Shared cache across all instances
- **Cache monitoring**: Detailed cache hit/miss logging
- **Cache errors**: Graceful degradation on cache failures

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check if port is in use
   sudo netstat -tlnp | grep :8080
   ```

2. **Permission errors**
   ```bash
   # Fix log directory permissions
   sudo chown -R $USER:$USER /var/log/coce
   ```

3. **Memory issues**
   ```bash
   # Monitor memory usage
   pm2 monit
   # Check for memory leaks in logs
   pm2 logs coce | grep '"memory"'
   ```

4. **Redis connection**
   ```bash
   # Check Redis status
   redis-cli ping
   # View Redis connection logs
   pm2 logs coce | grep '"redis"'
   ```

### Debug Mode
```bash
# Start in development mode with debug logging
pm2 start ecosystem.config.js --env development

# Enable verbose logging
LOG_LEVEL=debug pm2 restart coce
```

## Integration with Monitoring Tools

### ELK Stack (Elasticsearch, Logstash, Kibana)
Our structured JSON logs work perfectly with ELK:

```json
{
  "timestamp": "2025-07-14T15:00:00.000Z",
  "level": "info",
  "service": "coce",
  "message": "HTTP request completed",
  "request": {
    "method": "GET",
    "url": "/cover",
    "statusCode": 200,
    "duration": 150
  },
  "pm2": {
    "instanceId": "0",
    "pid": 12345
  }
}
```

### Prometheus + Grafana
Use the `/metrics` endpoint for Prometheus scraping:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'coce'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
```

### New Relic / DataDog
PM2 integrates with APM tools for advanced monitoring:

```bash
# Install New Relic module
npm install newrelic
pm2 install pm2-newrelic

# Install DataDog module
pm2 install pm2-datadog
```

## Security Considerations

### Process Isolation
- Each PM2 instance runs in isolation
- Shared Redis cache with proper authentication
- Environment variable protection

### Log Security
- Sensitive data filtering in production logs
- Log file permissions (600)
- Log rotation to prevent disk filling

### Network Security
- Health check endpoint doesn't expose sensitive data
- Request logging excludes sensitive headers
- Rate limiting can be added via reverse proxy

## Deployment Automation

### CI/CD Integration
```bash
# In your deployment script
pm2 stop coce
git pull origin master
npm install --production
pm2 start ecosystem.config.js --env production
pm2 save
```

### Blue-Green Deployment
```bash
# Zero-downtime deployment
pm2 reload coce  # Graceful restart of all instances
```

This PM2 configuration provides enterprise-grade process management, monitoring, and logging for Coce in production environments.
