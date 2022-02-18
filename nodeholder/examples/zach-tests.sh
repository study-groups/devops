
run-tests() {

  local test_outcome=0
  local orig_pwd=$PWD 
  # test setup / enter application directory
  local application_dir="$1";
  cd "/home/admin/src/$application_dir"

  # test for presence of app.log
  # 
  ls app.log
  test_outcome=$(expr $test_outcome + $?);
  handle-error "$test_outcome" "app.log not found"

  # test for presence of app.err
  ls app.err
  test_outcome=$(expr $test_outcome + $?);
  handle-error "$test_outcome" "app.err not found"

  # test for presence of app.pid
  ls app.pid
  test_outcome=$(expr $test_outcome + $?);
  handle-error "$test_outcome" "app.pid not found"

# https://www.unix.com/shell-programming-and-scripting/117076-how-check-if-file-contains-only-numeric-values.html
  # test that pid is a number
  grep -cv '[0-9]' app.pid
  test_outcome=$(expr $test_outcome + $?);
  handle-error "$test_outcome" "Incorrect pid type"
  
  # return final process status
  echo "$test_outcome"
}

handle-error() {
  if [ "$1"  -gt 0 ]
  then
	  echo "$2"
      return 1
  fi
  return 0
}
