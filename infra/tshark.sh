#!/usr/bin/env bash
tshark_helper() {
    local filters=' 
	    not ssh and 
	    not arp and
	    http or 
	    smtp or 
	    tcp.port != 22 and 
	    tcp.port != 7005
            '
    local fields='
     -e frame.number 
	   -e ip.src
	   -e ip.dst
	   -e _ws.col.Protocol
	   -e tcp.srcport
	   -e tcp.dstport
	   -e tcp.window_size
	   '
    echo "Executing: sudo tshark -Y \"$filters $1\" -T fields $fields"
    sudo tshark -Y "$filters $1" -T fields $fields
}

tshark_filter(){
filters="not ssh and (http or mysql or dns or smtp)"
    sudo tshark -Y "$filters $1"

}
tshark_run(){
    export filters="(tcp.port == 25 || tcp.port == 80 || tcp.port == 3306) && (ip.addr == 127.0.0.1 || ip.addr == <eth0_IP_address>)"
export fields="-e ip.src -e ip.dst -e _ws.col.Protocol"

local fields='
     -e frame.number 
	   -e ip.src
	   -e ip.dst
	   -e _ws.col.Protocol
	   -e tcp.srcport
	   -e tcp.dstport
	   -e tcp.window_size
	   '
 
  sudo tshark -Y "$filters" -T fields $fields
}
