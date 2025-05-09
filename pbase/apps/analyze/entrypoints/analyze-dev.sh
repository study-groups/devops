which node

while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    export "$line"
done < ./env/local.env


node --inspect ./api/server.mjs -- -dev
