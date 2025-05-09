// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'server',
      script: './server.mjs',
      watch: true,
      env: {
        NODE_ENV: 'development',
        API_KEY: process.env.API_KEY,
        PORT: process.env.PORT || 5001,
      },
    },
  ],
};
