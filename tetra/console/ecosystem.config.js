module.exports = {
  apps: [{
    name: 'tetra-console',
    script: './src/index.js', // The new main entry point
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
