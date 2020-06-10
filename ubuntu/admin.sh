# I'll delete this before check in.

# I'm curious what this looks like on your end. For me, it's colorizd
#in vim so I assume my colors are unique. I'd like to take screen shots
#in the coming weeks- its bad form to think what others see you see, and 
# vice versa. But these details are not the focus.

# Okay we are using an environment variable called USER.
# give me one second, the color scheme on my end is very hard to read.

# Did that change to black and white for you? It did me and this is good.
## yes it did
# cool, good to know, I think our default position should be no color,
# what do you think?
## I'm not against it. I kind of like some contrast, but I don't know the specific reason for the contrast, so I can't fight for it, ya know?
# yes, good, thank you. really I'm asking you to do with less because 
# I don't have my colors set up. To be clear, for me, the comments 
# were dark blue and on a black background making them hard to read.
# Was that your experience or is the color scheme unique and in our 
# individual control? I beileve the latter. g
## I saw blue on black as well. I don't blame you for changing it.
# But I think I differ from Crockford who thinks syntax highlighting 
# is for weenies. I don't think this and yet it is asking the editor 
# to do a lot more- in the case of no syntax lighting, the characters 
# dumped straight into standard out and on to the screen.
# With syntax highlighting, a bunch of non-printable characters are 
# interspersed (sp) with code and the unholy mess is made even better 
# than the original since vim works with the Terminal to display colored
# text.

# Let's go with black and white until we really understand how vim
# configuration works. During the gold rush, you would have found me
# selling shovels. (Vim.)

#ga
# I looked at the code last night and wanted to mention how what 
# I had started as a split personality when it comes to how assign, 
# and keep track of state.

# Having the APP name stuff be local defeats the purpose. We
# want to be passing that in at some point so we are * defining 
# an interface for creating apps * on the system. I don't know
# exactly what that should be.

# Secondly, USER is defined by the shell. So this is really 
# bad form here. Instead, we should be using the environment
# variable USER (I think). I say I think because explictly
# stating a user is odd and permissions would be wonky
# if someone other than the script runner is set as the 
# USER. In our case the USER calling this function is the 
# same as the USER defined in this file so we're good.
# But is is confusing and need to be addressed in some
# way. If you are here, you are down the rabbit hole
# meaning what, I'm not sure. My point is that we 
# lookig for the fewest lines of code to do what we 
# need and to be clear about it. By taking USER
# out of here we assume someone knows what they are 
# doing.
# any thoughts before I start editing?
## No, I hear what you're saying in re USER. 
## I also had some discomfort yesterday bc of the hard-coded repos.
## I'm glad my thinking hasn't been too far off.
# Great, yes, its good to be seeing things take shape together
# and see how to resolve 'configuration tension'. 
# I won't say it is in the way of anything. We are designing 
# code right now in response to a particular need- reasoning 
# about asset creation, ownership and tracking.

# Btw, we need to have logging on our radar. Rather than
# write our own, we should investigate syslogd. Logs are 
# something you have to deal with. It would be nice to 
# have a logging system that we can point anywhere.
# but in due time.

# This gets blown away but the file should/could have an
# introduction. One sentence or so. Tells where admin.sh
# fits in the picture.
#
# File starts below.
####################################################################
# Source these functions as admin. 

admin-help(){
  echo "\
Admin is a collection of scripts to configure runtime operations.

  # I was thinking that every prefix (e.g. admin-) should 
  # have a help. Further, we have a convention of a summary
  # sentence, we can snag the first line when called from 
  # a shell and thus summaize all of the tools in once 
  # sentence and in one place only.

  # This reads densely to me when it comes up in the terminal.
  # agreed?
  ## I might be biased for or against?!
  ## I think I'm for it because it removes our abstractions
  # yes, I think I'm hung up on "Run this remotely". 
  # I like the idea and spelling it out. It's the 
  # same reason why the this keyword in JS is to be avoided.
  # This in our case here refers to the script but you 
  # don't run it. You source it and then call admin-init
  # which is fine but I think this could be 
  # worded a bit better.

  # idea?
  ## spit balling
  # its great, especially the first
  # second is so hard because its such a dense command
  ## The question is how deeply do we want to explain Not too deep
  # with the code right there. But still, I think the way
  # you were saying what the command below is doing 
  # reads well. It's not intending to describe anything 
  # that requires a deep dive. But this may be the first 
  # exposure to 'real' ssh for many. I still get confused.
  # So I like the reinforcment via comments.
  # Meaning short but also said naturally rather than
  # having the reader parse the command line. Even if they
  # can, the narrative version feels easier to connect 
  # to other ideas that are essential for 'this' to all
  # hang together.

  
   Securely copy the admin.sh file to your new remote machine: 
    1) scp admin.sh ssh admin@host:admin.sh

   Source admin.sh on remote using ssh and call admin-init function:
   2) ssh admin@host: \"source admin.sh && admin-init\"

  Requires:
    - running as admin

  Configures a Unix server and account for process 'containers'
  addresseble by system defined TCP sockets. 
"
}

admin-install-sae(){
  # presume src directory exists
  cd /home/admin/src/

  local app_name=sentiment-analysis-engine
  local repo="https://gitlab.com/zoverlvx/$app_name.git";
  git clone $repo

  # presumes repo contains a directory called app that can be
  # served from this system.
  local app_dir="/home/admin/apps/$app_name"    # production app
  mkdir $app_dir
  cp -r /home/admin/src/$app_name/bin $app_dir  # change to match repo

  # set pwd to home for next function call
  cd /home/admin
}


admin-install-apps(){

  # make room for repos and app deployment.
  mkdir /home/admin/src/   # where apps are developed
  mkdir /home/admin/apps/  # where apps are deployed to production 

  admin-install-sae
}

admin-start-apps(){
# Start node servers (ports are currently defined by user, later system)

    # Future: loop over directories in  /home/admin/apps and call init.sh

    node /home/admin/apps/sentiment-analysis-engine/bin/www.js
}

# This local functions will be called. Comment out as needed.
admin-init(){
  admin-install-apps
  admin-start-apps
}
