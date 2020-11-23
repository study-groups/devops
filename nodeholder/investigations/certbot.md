# Certbot from Lets Encrypt

## nh-web-certbot hostname.com

devops@do5:~$ nh-web-certbot nodeholder.com
Saving debug log to /var/log/letsencrypt/letsencrypt.log
Plugins selected: Authenticator nginx, Installer nginx
Enter email address (used for urgent renewal and security notices)
 (Enter 'c' to cancel): xxxx@xxxxxx.xxx 

Obtaining a new certificate
Performing the following challenges:
http-01 challenge for nodeholder.com
http-01 challenge for www.nodeholder.com
Waiting for verification...
Cleaning up challenges
Deploying Certificate to VirtualHost /etc/nginx/sites-enabled/all-sites
Deploying Certificate to VirtualHost /etc/nginx/sites-enabled/all-sites
Redirecting all traffic on port 80 to ssl in /etc/nginx/sites-enabled/all-sites
Redirecting all traffic on port 80 to ssl in /etc/nginx/sites-enabled/all-sites

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Congratulations! You have successfully enabled https://nodeholder.com and
https://www.nodeholder.com
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

IMPORTANT NOTES:
 - Congratulations! Your certificate and chain have been saved at:
   /etc/letsencrypt/live/nodeholder.com/fullchain.pem
   Your key file has been saved at:
   /etc/letsencrypt/live/nodeholder.com/privkey.pem
   Your cert will expire on 2021-02-17. To obtain a new or tweaked
   version of this certificate in the future, simply run certbot again
   with the "certonly" option. To non-interactively renew *all* of
   your certificates, run "certbot renew"
 - Your account credentials have been saved in your Certbot
   configuration directory at /etc/letsencrypt. You should make a
   secure backup of this folder now. This configuration directory will
   also contain certificates and private keys obtained by Certbot so
   making regular backups of this folder is ideal.
 - If you like Certbot, please consider supporting our work by:

   Donating to ISRG / Let's Encrypt:   https://letsencrypt.org/donate
   Donating to EFF:                    https://eff.org/donate-le
