#!/usr/bin/env bash
# Installations- und Update-Test in einer frischen Debian-13-VM (SPEC 17.6, D-22).
# Läuft auf dem Entwicklungsrechner ohne root (QEMU/KVM, Benutzer-Netzwerk).
#
#   npm run test:vm                  testet den committeten Stand (HEAD)
#   KEEP_VM=1 npm run test:vm        VM danach nicht beenden (SSH: Port 2222)
#
# Ablauf: Cloud-Image laden und prüfen → VM starten → aus HEAD drei Test-Versionen bauen
# (gut, gut, mit kaputter Migration) → Szenario deploy/test/vm-scenario.sh in der VM.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CACHE=${POSTEULEN_VM_CACHE:-$HOME/.cache/posteulen-vm}
IMAGE_URL=https://cloud.debian.org/images/cloud/trixie/latest
IMAGE=debian-13-genericcloud-amd64.qcow2
SSH_PORT=${POSTEULEN_VM_SSH_PORT:-2222}
HTTPS_PORT=${POSTEULEN_VM_HTTPS_PORT:-8443}

say() { printf '\n\e[1m==> %s\e[0m\n' "$*"; }
fail() { printf '\e[31mFehler:\e[0m %s\n' "$*" >&2; exit 1; }

command -v qemu-system-x86_64 >/dev/null || fail "qemu-system-x86_64 fehlt."
command -v xorriso >/dev/null || fail "xorriso fehlt."
[[ -r /dev/kvm && -w /dev/kvm ]] || fail "Kein Zugriff auf /dev/kvm."
[[ -z $(git -C "$ROOT" status --porcelain -- . ':!docs/screenshots') ]] || echo "Hinweis: Nicht committete Änderungen werden NICHT getestet (nur HEAD)."

mkdir -p "$CACHE"
cd "$CACHE"

say "Debian-13-Cloud-Image prüfen"
curl --silent --show-error --fail --location --proto '=https' --proto-redir '=https' -o SHA512SUMS.new "$IMAGE_URL/SHA512SUMS"
expected=$(awk -v f="$IMAGE" '$2 == f {print $1}' SHA512SUMS.new)
[[ -n $expected ]] || fail "$IMAGE nicht in SHA512SUMS."
if [[ ! -f $IMAGE ]] || [[ $(sha512sum "$IMAGE" | cut -d' ' -f1) != "$expected" ]]; then
  curl --silent --show-error --fail --location --proto '=https' --proto-redir '=https' -o "$IMAGE.part" "$IMAGE_URL/$IMAGE"
  [[ $(sha512sum "$IMAGE.part" | cut -d' ' -f1) == "$expected" ]] || fail "Prüfsumme des Images stimmt nicht."
  mv "$IMAGE.part" "$IMAGE"
fi
mv SHA512SUMS.new SHA512SUMS
echo "Image geprüft (SHA-512)."

[[ -f vm_key ]] || ssh-keygen -q -t ed25519 -N '' -f vm_key -C posteulen-vm-test
run_dir=$(mktemp -d "$CACHE/run.XXXXXX")
trap 'if [[ ${KEEP_VM:-0} != 1 && -f $run_dir/qemu.pid ]]; then kill "$(cat "$run_dir/qemu.pid")" 2>/dev/null || true; fi' EXIT

say "Test-Versionen aus HEAD bauen"
work="$run_dir/repo"
git clone --quiet --no-local "$ROOT" "$work"
git -C "$work" -c user.name=vmtest -c user.email=vmtest@invalid commit --quiet --allow-empty -m "VM-Test: Version 1"
version=$(sed -n "s/^export const VERSION = '\(.*\)';$/\1/p" "$work/shared/src/version.ts")
set_version() {
  sed -i "s/^export const VERSION = '.*';$/export const VERSION = '$1';/" "$work/shared/src/version.ts"
}
set_version "$version-vmtest.1"
git -C "$work" -c user.name=vmtest -c user.email=vmtest@invalid commit --quiet -am "VM-Test 1"
git -C "$work" tag "v$version-vmtest.1"
set_version "$version-vmtest.2"
git -C "$work" -c user.name=vmtest -c user.email=vmtest@invalid commit --quiet -am "VM-Test 2"
git -C "$work" tag "v$version-vmtest.2"
set_version "$version-vmtest.3"
next=$(($(find "$work/backend/migrations" -name '*.sql' | wc -l) + 1))
printf -- '-- Absichtlich kaputt (VM-Test: Rückfall).\nCREATE TABLE vmtest_broken (x INTEGER) STRICT;\nINSERT INTO gibt_es_nicht VALUES (1);\n' >"$work/backend/migrations/$(printf '%04d' "$next")_vmtest_broken.sql"
git -C "$work" add -A
git -C "$work" -c user.name=vmtest -c user.email=vmtest@invalid commit --quiet -m "VM-Test 3 (kaputt)"
git -C "$work" tag "v$version-vmtest.3"
git -C "$work" bundle create --quiet "$run_dir/posteulen.bundle" --all

say "VM starten"
qemu-img create -q -f qcow2 -b "$CACHE/$IMAGE" -F qcow2 "$run_dir/disk.qcow2" 12G
mkdir -p "$run_dir/seed"
cat >"$run_dir/seed/user-data" <<UD
#cloud-config
hostname: posteulen-vm
users:
  - name: debian
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - $(cat "$CACHE/vm_key.pub")
UD
printf 'instance-id: posteulen-%s\nlocal-hostname: posteulen-vm\n' "$(date +%s)" >"$run_dir/seed/meta-data"
xorriso -as mkisofs -quiet -output "$run_dir/seed.iso" -volid cidata -joliet -rock "$run_dir/seed" 2>/dev/null
qemu-system-x86_64 -machine q35,accel=kvm -cpu host -m 2048 -smp 2 \
  -drive "file=$run_dir/disk.qcow2,if=virtio" -drive "file=$run_dir/seed.iso,media=cdrom" \
  -netdev "user,id=n0,hostfwd=tcp:127.0.0.1:$SSH_PORT-:22,hostfwd=tcp:127.0.0.1:$HTTPS_PORT-:443" \
  -device virtio-net-pci,netdev=n0 -display none -serial "file:$run_dir/console.log" \
  -daemonize -pidfile "$run_dir/qemu.pid"

ssh_vm() {
  ssh -q -i "$CACHE/vm_key" -p "$SSH_PORT" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=5 -o BatchMode=yes debian@127.0.0.1 "$@"
}
for _ in $(seq 1 60); do ssh_vm true 2>/dev/null && break; sleep 3; done
ssh_vm true || fail "VM per SSH nicht erreichbar (Konsole: $run_dir/console.log)."
echo "VM läuft."

say "Szenario in der VM"
scp -q -i "$CACHE/vm_key" -P "$SSH_PORT" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  "$run_dir/posteulen.bundle" "$ROOT/deploy/test/vm-scenario.sh" debian@127.0.0.1:/tmp/
set +e
ssh_vm "sudo bash /tmp/vm-scenario.sh '$version' $HTTPS_PORT" 2>&1 | tee "$run_dir/scenario.log"
status=${PIPESTATUS[0]}
set -e

say "Zugriff von außen (Host → VM)"
if curl --silent --insecure --max-time 10 --resolve "posteulen.test:$HTTPS_PORT:127.0.0.1" "https://posteulen.test:$HTTPS_PORT/api/health" | grep -q '"status":"ok"'; then
  echo "✔ Von außen erreichbar."
  ssh_vm "sudo systemctl stop posteulen; sleep 1" >/dev/null
  curl --silent --insecure --max-time 10 --resolve "posteulen.test:$HTTPS_PORT:127.0.0.1" "https://posteulen.test:$HTTPS_PORT/api/health" >/dev/null || true
  ssh_vm "sudo systemctl start posteulen; sleep 2"
  if ssh_vm "sudo journalctl -u caddy -u posteulen --no-pager" | grep -q '10\.0\.2\.2'; then
    echo "✘ Die IP-Adresse des Clients steht im Journal (SPEC 2.2)."
    status=1
  else
    echo "✔ Keine Client-IP im Journal, auch nicht bei einem Proxy-Fehler."
  fi
else
  echo "✘ Von außen nicht erreichbar."
  status=1
fi

echo
echo "Protokoll: $run_dir/scenario.log"
[[ $status -eq 0 ]] && echo "VM-TEST BESTANDEN" || echo "VM-TEST FEHLGESCHLAGEN"
exit "$status"
