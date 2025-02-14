FROM ubuntu:22.04
RUN apt-get update && \
    apt-get install -y ssh-client openssh-server mysql-client vim && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
#COPY entrypoint.sh .
#RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]

