module.exports = {
  apps: [{
    name: 'coce',
    script: 'app.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      LOG_FILE: '/var/log/coce/coce.log'
    },
    
    // Development environment
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      watch: true,
      ignore_watch: ['node_modules', 'logs', 'test']
    },
    
    // Logging configuration
    log_file: '/var/log/coce/combined.log',
    out_file: '/var/log/coce/out.log',
    error_file: '/var/log/coce/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    max_memory_restart: '500M',
    log_type: 'json',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Performance monitoring
    pmx: true,
    instance_var: 'INSTANCE_ID',
    source_map_support: false,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Watch options
    watch_options: {
      followSymlinks: false,
      usePolling: false
    }
  }],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com', 'server2.example.com'],
      ref: 'origin/master',
      repo: 'git@github.com:username/coce.git',
      path: '/var/www/coce',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    }
  }
};
