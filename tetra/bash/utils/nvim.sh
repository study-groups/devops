
tetra_nvim_clean_mac(){
  brew uninstall nvim
  tertra_nvim_clean_config
}
tetra_nvim_clean_config(){
  rm -rf $HOME/.config/nvim
  rm -rf $HOME/.local/share/nvim
  rm -rf $HOME~/.cache/nvim
  rm -rf $HOME~/.local/state/nvim
  rm -rf $HOME~/.local/share/nvim
}

tetra_nvim_install_mac(){
  brew install nvim
  tetra_nvim_install_pluginmgr
}
tetra_nvim_install_pluginmgr(){
  # packer is Lua based package mgr, works parallel to 
  # native Neovim package manager  ~/.config/nvim/pack
  # Packer uses  ~/.config/nvim/init.vim
  git clone --depth 1 https://github.com/wbthomason/packer.nvim \
 $HOME/.local/share/nvim/site/pack/packer/start/packer.nvim
}

tetra_nvim_install_telescope(){
echo "In ~/./config/nvim/init.lua"
echo "Add to packer.startup(function(use):"
cat <<'EOF'
use {
  'nvim-telescope/telescope.nvim', tag = '0.1.x',
  requires = { {'nvim-lua/plenary.nvim'} }
}
EOF
}
tetra_nvim_ls_plugins(){
  local dir=$HOME/.local/share/nvim/site/pack/packer/start/
  echo "ls $dir"
  ls $dir
}
