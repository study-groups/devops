# Currently test-setup polutes env with globals:
# remoteUser
# remoteHost
# remoteCmd

# Need to add remoteIp for future tests

# Could test:
# PID file contents created by daemonize
# stdout file name, existence before content
# stderr empty?
# try remote "ps -ef | grep appname"
# instead of a single "shoudEqual" multiple
# things to test for. (This would require
# all tests pass so tallying return value
# from call to call would have to be done.
# If retVal = retVal + newRetVal remains 0
# then no tests failed. Otherwise something 
# failed.
test-appInit(){
  local remote_logfile="/home/admin/src/node-hello-world/development/app.log" 
  remoteCmd="cat $remote_logfile"

  local shouldEqual="Node hello world running on port 4000"
  local retVal=$(ssh $remoteUser@$remoteHost $remoteCmd );

  test-showTestInfo >&2

   # return 0 if true, 1 if false to standard out.
  # $? may be cheched by caller.
  if [[ "$shouldEqual" == "$retVal" ]]; then
    echo "test pass" >&2
    echo 0 #pass
  else
    echo "test failed" >&2
    echo 1 #fail
  fi 
}


# Refactor to something meaninful (requires establishing
# logging/status/feedback mechanism when calling config.sh
# on the remote host.
test-checkConfigLog(){
  remoteCmd="cat config.log"
  local shouldEqual="status=pending"
  local retVal=$(ssh $remoteUser@$remoteHost $remoteCmd );
  test-showTestInfo >&2
  echo "remoteCmd returned: $retVal"  >&2
  
  # return 0 if true, 1 if false to standard out.
  # $? may be cheched by caller.
  if [[ "$shouldEqual" == "$retVal" ]]; then
    echo "test pass" >&2
    echo 0 #pass
  else
    echo "test failed" >&2
    echo 1 #fail
  fi 
}

# Polutes shell.
test-setup(){
  remoteUser=admin
  remoteHost=$(dotool-name-to-ip doX)
  remote="$remoteUser@$remoteHost"
}

# Currently called by each test. Maybe runTest
# should call before each test and have test
# only return true or false.

test-showTestEnvInfo(){
  echo "
  remoteUser: $remoteUser
  remoteHost: $remoteHost
"
}


test-showTestInfo(){
  echo "
  remoteCmd:  $remoteCmd
  shoudEqual: $shouldEqual
  retVal:     $retVal
"
}


# Todo: add counter and check for retVal to flag
# failed tests.
test-runTests(){
  test-setup
  test-showTestEnvInfo
  test-checkConfigLog
  test-appInit
}
