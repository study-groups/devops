#TODO: create function 

# 1. dotool-create dropletName keyId image  
# 2. node-config dropletName config.sh   (change to nodeholder-config ?)
# 3. WRITE: nodeholder-create-aliases childName dropletIp  (to create this file)
# 4. doY-install-admin (alternatively, how could this be a function?)
# 4. doY-
# 5. test for:
#    - doY-app-status
#    - http $doY:$appPort
# 6. doY-admin-undo-init

alias doX-install-admin="scp ./admin.sh admin@$doX:~/admin.sh && \
  ssh admin@$doX 'echo "NODEHOLDER_ROLE=child" >> ~/admin.sh' && \
  scp -r ./buildpak admin@$doX:~/"
alias doX-admin-undo-init="ssh admin@$doX 'source admin.sh && admin-undo-init'"
alias doX-admin-init="ssh admin@$doX 'source admin.sh && admin-init'"
alias doX-app-start="ssh admin@$doX 'source admin.sh && app-start'"
alias doX-app-status="ssh admin@$doX 'source admin.sh && app-status'"
alias doX-app-stop="ssh admin@$doX 'source admin.sh && app-stop'"

alias doY-install-admin="scp ./admin.sh admin@$doY:~/admin.sh && \
  ssh admin@$doY 'echo "NODEHOLDER_ROLE=child" >> ~/admin.sh' && \
  scp -r ./buildpak admin@$doY:~/"
alias doY-admin-undo-init="ssh admin@$doY 'source admin.sh && admin-undo-init'"
alias doY-admin-init="ssh admin@$doY 'source admin.sh && admin-init'"
alias doY-app-start="ssh admin@$doY 'source admin.sh && app-start'"
alias doY-app-status="ssh admin@$doY 'source admin.sh && app-status'"
alias doY-app-stop="ssh admin@$doY 'source admin.sh && app-stop'"
