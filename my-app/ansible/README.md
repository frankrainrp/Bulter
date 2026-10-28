# Ansible Deployment

This folder demonstrates the Infrastructure as Code requirement for C270.

Run locally after replacing `repo_url` in `inventory.example.ini`:

```bash
ansible-playbook -i ansible/inventory.example.ini ansible/deploy-butler.yml
```

The playbook installs Docker, checks out the repository, starts the app with
Docker Compose, and verifies `http://127.0.0.1:3000/api/health`.
