module.exports = {
  apps: [{
    name: 'tetra-console',
    script: './src/index.js',
    watch: ['./src'],
    ignore_watch: ['node_modules'],
    watch_options: {
      followSymlinks: false
    },
    env: {
      "NODE_ENV": "development",
    }
  }]
};

