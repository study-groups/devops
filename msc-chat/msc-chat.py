import streamlit as st
import pandas as pd
import json
import time
import os
#from scapy.all import rdpcap
import pyshark
from collections import Counter

# Sidebar
st.sidebar.title("Upload PCAP File")
uploaded_file = st.sidebar.file_uploader("Choose a PCAP file", type="pcap")

# Initialize or get the session state
if 'start_packet' not in st.session_state:
    st.session_state['start_packet'] = 0
if 'end_packet' not in st.session_state:
    st.session_state['end_packet'] = 0

st.session_state['start_packet'] = st.sidebar.number_input("Start Packet", min_value=0, value=st.session_state['start_packet'])
st.session_state['end_packet'] = st.sidebar.number_input("End Packet", min_value=st.session_state['start_packet'], value=st.session_state['end_packet'])
prev_button = st.sidebar.button('Prev')
next_button = st.sidebar.button('Next')

# If 'Next' button is clicked, increment 'start_packet' and 'end_packet' in session state
if next_button:
    st.session_state['start_packet'] += 1
    st.session_state['end_packet'] += 1

# If 'Next' button is clicked, increment 'start_packet' and 'end_packet' in session state
if prev_button:
    st.session_state['start_packet'] -= 1
    st.session_state['end_packet'] -= 1

# Main app
st.title("msc-chat")
import pyshark
import tempfile

def pcap_to_iff(uploaded_file):
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(uploaded_file.read())
    
    cap = pyshark.FileCapture(tmp.name)
    data = []
    relTime=0;
    deltaTime=0;
    prevTime=0;
    startTime=0;
    timestamp = 0;

    for i, packet in enumerate(cap):
        timestamp = float(packet.sniff_timestamp)
        if i != 0:
            relTime = curTime - startTime
            deltaTime = curTime - prevTime
            prevTime = timestamp
        else: 
            relTime = 0
            deltaTime = 0
            curTime = timestamp

        # Extract additional information
        sourceIp = packet.ip.src if hasattr(packet, 'ip') else None
        dstIp = packet.ip.dst if hasattr(packet, 'ip') else None
        protocol = packet.transport_layer if hasattr(packet, 'transport_layer') else None

        summary = f"{relTime} ({deltaTime}): {sourceIp} > {dstIp}, Protocol: {protocol}"
        vector = [i, sourceIp, dstIp]
        data.append({
            'summary': summary,  # Set txt to the packet summary
            'meta':{           
                'id': timestamp,
                'relTime': relTime,
                'deltaTime': deltaTime,
                'app': packet.highest_layer,
                'seqNum': i, 
                'sourceIp': sourceIp,
                'dstIp': dstIp,
                'protocol': protocol,
                'vector': vector,
            },
        })

        

    os.unlink(tmp.name)
    return data

def generate_summary(iffs, label):
    # Generate summary of unique src, dst, and protocol of packets
    src_counter = Counter(iff['meta']['sourceIp'] for iff in iffs if iff['meta']['sourceIp'] is not None)
    dst_counter = Counter(iff['meta']['dstIp'] for iff in iffs if iff['meta']['dstIp'] is not None)
    protocol_counter = Counter(iff['meta']['protocol'] for iff in iffs if iff['meta']['protocol'] is not None)

    # Create the summary report in one line
    report = f"{label} Summary: Unique Source IPs: {dict(src_counter)}, Unique Destination IPs: {dict(dst_counter)}, Protocol Usage: {dict(protocol_counter)}"

    # Display the report
    st.write(report)


def filter_iff(data, start, end):
    # Filter the data based on start and end packet numbers
    filtered = data[start:end]

    # Write to filter.iff
    with open('filter.iff', 'w') as f:
        for item in filtered:
            f.write(json.dumps(item))
            f.write('\n')  # newline separator
    
    return filtered

# If file is uploaded, process and display it
if uploaded_file is not None:
    data = pcap_to_iff(uploaded_file)
    # Write to current.iff
    with open('current.iff', 'w') as f:
        for item in data:
            f.write(json.dumps(item))
            f.write('\n')  # newline separator

# Load data from current.iff
with open('current.iff', 'r') as f:
    data = [json.loads(line) for line in f]

# Generate summary of the data
generate_summary(data, 'Full Data')

# Filter the data
filtered = filter_iff(data, st.session_state['start_packet'], st.session_state['end_packet'])

# Generate summary of the filtered data
generate_summary(filtered, 'Filtered Data')

# Display the filtered data
st.write(filtered)
