Tetra Console - Configuration at Distance
Type 'help' for commands, 'functions' for all available functions
Use 'exit' or Ctrl+C to quit

tetra> help
Tetra Console - Configuration at Distance
===============================================

Service Management:
  start <service>           Start local service (requires tsm)
  stop <process>            Stop process (requires tsm)
  list                      List running processes (requires tsm)
  logs <process> [-f]       Show process logs (requires tsm)
  restart <process>         Restart process (requires tsm)

Key Management:
  generate <env> <type>     Generate SSH keys (requires tkm)
  deploy-keys <env>         Deploy keys to environment (requires tkm)
  revoke <env>              Revoke environment keys (requires tkm)
  audit [env]               Security audit (requires tkm)

Module Management:
  load <module>             Load tetra module
  unload <module>           Unload module
  modules                   List loaded modules

Configuration at Distance:
  run <target> "<command>"      Execute command remotely
  tunnel <target:port>          Create SSH tunnel
  exec <target> "<command>"     Direct remote execution
  targets                       List available targets
  test <target>                 Test connectivity to target

System:
  help, h                   Show this help
  functions, f              Show all available functions
  status, s                 Show system status
  exit, q                   Exit REPL

Examples:
  start tetra               Start tetra-4444 service locally
  run staging "start tetra" Start tetra service on staging
  generate staging deploy   Generate staging deployment keys
  tunnel staging:4444       Access staging tetra via tunnel
  load tsm                  Load service manager module

Type 'functions' for complete function reference.

tetra> 
