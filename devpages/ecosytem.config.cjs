module.exports = {
  apps: [{
    name: `devpages-${process.env.PORT || 4000}`,
    script: "./server/server.js",
    cwd: __dirname,
    node_args: [],
    instances: 1,
    exec_mode: "fork",
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: process.env.PORT || "4000",
      PD_DIR: process.env.PD_DIR || "/Users/mricos/nh/mr/pd"
    },
    out_file: "./logs/devpages.out.log",
    error_file: "./logs/devpages.err.log",
    merge_logs: true
  }]
}
