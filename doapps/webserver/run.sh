# run daemonized, iteractive with terminal output, map port 52022
# to 

docker run --name $app -d -it \
	--restart always \
	-v $htdocs:/usr/local/apache2/htdocs \
	-p $appHttpPort:80 \
	-p $appHttpsPort:443 \
        $image
