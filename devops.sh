devops-help(){
  cat <<EOF
devops.sh is a catch-all for first-run work before
implementing in tetra or nodeholder.
EOF
}

devops-new-mkdocs-project(){
  # need to be in a pyenv env.
  # pip install mkdocs
  # pip install --upgrade python-markdown-math
  # https://www.mkdocs.org/getting-started/
  mkdocs new $1 
}

# probably should be in ds-study-group/dstool.sh
devops-install-pyenv(){
   # git clone https://github.com/pyenv/pyenv.git ~/.pyenv
   curl https://pyenv.run | bash
   pyenv update
}

root-install-julia(){
  wget https://julialang-s3.julialang.org/bin/linux/x64/\
1.7/julia-1.7.3-linux-x86_64.tar.gz
  tar zxvf julia-1.7.3-linux-x86_64.tar.gz
  mv julia-1.7.3/ /opt/
  ln -s /opt/julia-1.7.3/bin/julia /usr/local/bin/julia

cat <<EOF
To add Julia to Jupyter and enter:
using Pkg
Pkg.add(“IJulia”)
or
using IJulia
installkernel("Julia")
EOF
}

root-add-r(){
   apt install dirmngr gnupg apt-transport-https \
   ca-certificates software-properties-common

  sudo add-apt-repository \
  'deb https://cloud.r-project.org/bin/linux/ubuntu focal-cran40/'

  sudo apt-key adv --keyserver keyserver.ubuntu.com \
  --recv-keys E298A3A825C0D65DFD57CBB651716619E084DAB9
}

root-install-r(){
  apt install r-base
  apt install libxml2-dev
  apt install libssl-dev
  apt install libcurl4-openssl-dev

cat<<EOF
In R:
install.packages("devtools")
devtools::install_github("IRkernel/IRkernel")
IRkernel::installspec()
EOF
}
