# Jitsi configuration notes for a tetra node.

This guide assumes you have provisioned a Linux Virtual
Private Server (VPS) with nodeholder/bash/nh-admin.sh.
This provides an Nginx server and certbot with an
admin user account with ssh key login.

jitsi.sh is a collection of tools for managing 
a self-hosted Jitsi install.

## Install
Follow the directions at
[Digital Ocean](https://www.digitalocean.com/community/tutorials/how-to-install-jitsi-meet-on-ubuntu-18-04)


## Firewall

Off by default.

```
80 TCP    - for SSL certificate verification / renewal with Let's Encrypt
443 TCP   - for general access to Jitsi Meet
10000 UDP - for general network video/audio communications
22 TCP    - if you access you server using SSH 
            (change the port accordingly if it's not 22)
3478 UDP  - for quering the stun server (coturn, optional,
             needs config.js change to enable it)
5349 TCP  - for fallback network video/audio communications 
            over TCP (when UDP is blocked for example), served by coturn
```

## Prosody
"Prosody is xmpp server, all components connect to it so they can
communicate using xmpp protocol.  This includes web, jicofo,
jitsi-videobridge and the rest of the components." @damencho

## Jicofo
"Jicofo is the first to enter a room and orcestrates the 
conference, sending invites, opening channels on the 
videobridge and such." @damencho 


## Config files
```
/etc/jitsi/videobridge/config 
    JVB_SECRET=XXXXXXXXX

/etc/jitsi/videobridge/jvb.conf

/etc/jitsi/videobridge/log4j2.xml
    <Property name="log-path">/var/log/jitsi</Property>

/etc/jitsi/videobridge/callstats-java-sdk.properties
    CallStats.BaseURL = https://collector.callstats.io:443

/etc/jitsi/videobridge/sip-communicator.properties

/etc/jitsi/videobridge/callstats-java-sdk.properties
    CallStats.BaseURL = https://collector.callstats.io:443

/etc/jitsi/meet/jitsi.study-groups.org-config.js

/etc/jitsi/jicofo/config 
   JVB_OPTS="–apis=xmpp,rest"

/etc/jitsi/jicofo/jicofo.conf

/etc/jitsi/jicofo/logging.properties
```

## Videobridge

### Sip 

## Systemctl
```
systemctl status nginx
systemctl status jitsi-videobridge2
systemctl status prosody
```

## Errors

### Strophe
```
strophe.umd.js:5123 
POST https://jitsi.study-groups.org/http-bind?
     room=kindsuppliesimplyotherwise 502 (Bad Gateway)
```

## References
- [github/jitsi](https://github.com/jitsi/jitsi)
- [Jitsi Self-hosting guide](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart)
- [Prosody/xmpp/jicofo relationship](https://community.jitsi.org/t/what-is-the-exact-role-of-prosody-as-xmpp-server-and-jicofo/43934)
