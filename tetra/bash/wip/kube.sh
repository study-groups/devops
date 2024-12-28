tetra_kube_status(){
  kubectl cluster-info
  kubectl get nodes
  kubectl get pods --all-namespaces
}

tetra_kube_make_pod_netcast(){
cat <<EOF > ./netcat-pod.yml
apiVersion: v1
kind: Pod
metadata:
  name: netcat-pod
  labels:
    app: netcat
spec:
  containers:
  - name: netcat-container
    image: busybox
    command: ["sh", "-c", "while true; do nc -l -p 4000; done"]
    ports:
    - containerPort: 4000
EOF

kubectl apply -f ./netcat-pod.yaml

}

tetra_kube_pod_as_service_netcat(){
cat <<EOF > ./netcat-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: netcat-service
spec:
  selector:
    app: netcat
  ports:
  - protocol: TCP
    port: 4000
    targetPort: 4000
  type: NodePort

EOF

  kubectl apply -f netcat-service.yaml

}

tetra_kube_get_svc_netcat(){
  kubectl get svc netcat-service

# Example output
# NAME          TYPE      CLUSTER-IP    EXTERNAL-IP PORT(S)         
#netcat-service NodePort  10.99.166.103  <none>     4000:30977/TCP 

}
