tetra-nvim-clean-mac(){
  brew uninstall nvim
  rm -rf ~/.config/nvim
  rm -rf ~/.local/share/nvim
  rm -rf ~/.cache/nvim
  rm -rf ~/.local/state/nvim
  rm -rf ~/.local/share/nvim
}

tetra-nvim-install-mac(){
  brew install nvim
  # packer is Lua based package mgr, works parallel to 
  # native Neovim package manager  ~/.config/nvim/pack
  # Packer uses  ~/.config/nvim/init.vim
  git clone --depth 1 https://github.com/wbthomason/packer.nvim\
 ~/.local/share/nvim/site/pack/packer/start/packer.nvim
}
