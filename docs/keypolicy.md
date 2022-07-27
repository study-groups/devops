# Tetra Key Policy

## Terms 
The Tetra Key Policy (TKP) is a prescription for SSH key custody for
keys that allow SSH connections from ROOT and DEVOPS users.

- **Hypervisor Key Escrow (HKE):** During the creation of a 
 virtual private server (VPS), the creator must select a SSH key pair
 that has previously been uploaded to the hypervisor company,
e.g. [Digital Ocean](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/to-team/).

- **Quarterly Provision Key (QPK):** This key is genrated by a steward
and labeled with provisioning company, season and year. For example,
machines provisoned in the Fall of 2022 at Digital Ocean: `do-fall-2022`

- **Devops Pass Phrase (DPP):** Hard to crack password created by Operator
and given to user with Devops permissions.
 

## Useful functions for key management 
```bash
tetra-decrypt           tetra-htpasswd-set           
tetra-dev-notes         tetra-make-env               
tetra-devops-help       tetra-make-nginx-proxy       
tetra-encrypt           tetra-monitor-help           
tetra-ssh-add                
tetra-ssh-init
```
## Examples

### Creating encrypted, custom  devops.sh.enc
```
$> TETRA_QPK_PUB="/root/.ssh/do-spring-2023");
$> TETRA_QPK_PRIV="/root/.ssh/do-spring-2023");
$> DEVOPS_PASSPHRASE="OperatorCreatesThisAndTellsRecipient"
$> tetra-make-env | tetra-encrpt "$DEVOPS_PASSPHRASE" > devops.sh.enc
```
