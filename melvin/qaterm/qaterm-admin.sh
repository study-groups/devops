qat_vimrc(){
  cat $HOME/.vimrc
}

qat_vim_functions(){
cat << EOF
function! SendToQQ()
  " Save the current buffer
  write

  " Get the selected text
  let l:selection = join(getline("'<", "'>"), "\n")

  " Run the command and capture the output
  let l:cmd = 'echo "' . shellescape(l:selection) . '" | qq'
  let l:output = system(l:cmd)

  " Open a new split and display the response
  split | setlocal buftype=nofile
  call setline(1, split(l:output, "\n"))
endfunction

" Map the function to a key sequence
xnoremap <leader>qq :<C-U>call SendToQQ()<CR>
EOF

}

qa_install(){
  qat_vim_functions >> $HOME/.vimrc
}

qat_help_install(){
  echo
  echo "   'qat_vim_functions >> $HOME/.vimrc'"
  echo 
  cat << EOF

  Creates SendToQQ() in vim
    - getline("'<", "'>"): Retrieves the selected text from visual mode.
    - shellescape(): Escapes the text for safe shell execution.
    - system(): Runs the command in the shell and captures the output.
    - split: Opens a new split window.
    - setline(1, ...): Sets the lines of new buffer with qq response.
EOF
}
