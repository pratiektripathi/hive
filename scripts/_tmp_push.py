import io
import secrets
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(r"D:\hive")
APP_PATH = "/opt/hive-template-importer"
EXCLUDE_DIRS = {".git", "node_modules", "dist", "__pycache__", ".venv", ".cursor"}
EXCLUDE_FILES = {".vps", ".env", "_tmp_push.py"}


def load_vps():
    cfg = {}
    for line in (ROOT / ".vps").read_text().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip()
    return cfg


def pack():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            if not path.is_file():
                continue
            if any(part in EXCLUDE_DIRS for part in path.parts):
                continue
            if path.name in EXCLUDE_FILES or path.suffix == ".pyc":
                continue
            tar.add(path, arcname=path.relative_to(ROOT).as_posix())
    buf.seek(0)
    return buf


def main():
    cfg = load_vps()
    archive = pack()
    print(f"archive bytes={archive.getbuffer().nbytes}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        cfg["vps_url"],
        username="root",
        password=cfg["vps_pass"],
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    with sftp.file("/tmp/hive-src.tgz", "wb") as remote:
        remote.write(archive.read())
    sftp.close()
    print("uploaded archive")

    postgres_password = secrets.token_urlsafe(24)
    secret_key = secrets.token_hex(32)

    setup = f"""
set -euo pipefail
mkdir -p {APP_PATH}
tar -xzf /tmp/hive-src.tgz -C {APP_PATH}
rm -f /tmp/hive-src.tgz
mkdir -p {APP_PATH}/resources
if [ ! -f {APP_PATH}/.env ]; then
  umask 077
  cat > {APP_PATH}/.env <<'EOF'
POSTGRES_DB=hive
POSTGRES_USER=hive
POSTGRES_PASSWORD={postgres_password}
SECRET_KEY={secret_key}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ENVIRONMENT=production
FRONTEND_URL=https://hive.100xseller.com
BACKEND_URL=https://hiveapi.100xseller.com
VITE_API_BASE=https://hiveapi.100xseller.com/api
EOF
fi
docker network inspect proxy >/dev/null
cd {APP_PATH}
docker compose config >/tmp/hive-template-importer-compose-check.txt
echo 'compose config ok'
"""
    stdin, stdout, stderr = client.exec_command(setup, timeout=60)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(out)
    if err:
        print(err[-3000:])
    if code != 0:
        raise SystemExit(f"setup failed: {code}")

    build = f"""
set -euo pipefail
cd {APP_PATH}
docker compose up -d --build --remove-orphans
docker compose ps
"""
    stdin, stdout, stderr = client.exec_command(build, timeout=900)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(out[-8000:])
    if err:
        print(err[-8000:])
    if code != 0:
        raise SystemExit(f"build failed: {code}")
    client.close()
    print("deploy command finished")


if __name__ == "__main__":
    main()
