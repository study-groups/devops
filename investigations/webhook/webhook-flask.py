from flask import Flask, request, jsonify
import hmac
import hashlib

app = Flask(__name__)
secret = b'iamasecret'

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Hub-Signature')
    if not is_valid_signature(request.data, signature):
        return "Signature verification failed.", 403

    # Process the GitHub event here
    event = request.headers.get('X-GitHub-Event')
    payload = request.json
    # Add your logic for different GitHub events
    return jsonify({'status': 'success'}), 200

def is_valid_signature(data, header_signature):
    if header_signature is None:
        return False
    sha_name, signature = header_signature.split('=')
    if sha_name != 'sha1':
        return False
    mac = hmac.new(secret, msg=data, digestmod=hashlib.sha1)
    return hmac.compare_digest(mac.hexdigest(), signature)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
