module.exports = {
  apps: [
    {
      name: 'hotrod-listener',
      script: './hotrod.sh',
      args: '--pm2-listener',
      cwd: './',
      autorestart: true,
      watch: false,
      env: {
        PORT: '9999',
      },
    },
    {
      name: 'hotrod-ssh-tunnel',
      script: './hotrod.sh',
      args: '--pm2-tunnel',
      cwd: './',
      autorestart: true,
      watch: false,
    },
  ],
};
