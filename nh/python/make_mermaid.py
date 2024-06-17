import os
import json

# Get the NH_DIR environment variable
nh_dir = os.getenv('NH_DIR', '')
input_file_path = os.path.join(nh_dir, 'digocean.json')

# Read the JSON data from the file
with open(input_file_path, 'r') as file:
    data = json.load(file)

# Initialize the Mermaid code
mermaid_code = 'graph TD\n'

# Helper function to create Mermaid nodes
def create_mermaid_node(id, label):
    return f'{id}["{label}"]'

# Add Droplets
for droplet in data.get('Droplets', []):
    droplet_id = f'droplet_{droplet["id"]}'
    mermaid_code += create_mermaid_node(droplet_id, droplet["name"]) + '\n'
    
    for v4_network in droplet.get('networks', {}).get('v4', []):
        ip_type = 'Public IP' if v4_network["type"] == "public" else 'Private IP'
        ip_id = f'ip_{v4_network["ip_address"].replace(".", "_")}'
        mermaid_code += create_mermaid_node(ip_id, f'{ip_type} | {v4_network["ip_address"]}') + '\n'
        mermaid_code += f'{droplet_id} --> {ip_id}\n'

# Add Volumes
for volume in data.get('Volumes', []):
    volume_id = f'volume_{volume["id"]}'
    mermaid_code += create_mermaid_node(volume_id, volume["name"]) + '\n'
    
    for droplet_id in volume.get('droplet_ids', []):
        droplet_node_id = f'droplet_{droplet_id}'
        mermaid_code += f'{volume_id} --> {droplet_node_id}\n'

# Add Private Images
for image in data.get('PrivateImages', []):
    image_id = f'image_{image["id"]}'
    mermaid_code += create_mermaid_node(image_id, image["name"]) + '\n'

# Output the Mermaid code
print(mermaid_code)
