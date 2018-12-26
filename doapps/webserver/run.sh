source .env

# run daemonized, iteractive with terminal output, map port 52022
# to 22

docker run --name $app -d -it \
	-v $htdocs:/usr/local/apache2/htdocs\
	-p $appHttpPort:80 \
	-p $appHttpsPort:443 \
        $image	
