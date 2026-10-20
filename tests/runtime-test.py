#!/usr/bin/env python3
"""Check startup snapshots and read-only runtime inspection without a router."""
import shlex
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = shlex.quote(str(ROOT / 'root/usr/libexec/frpc-config-fields'))
source = (ROOT / 'root/etc/init.d/frpc').read_text().replace(
    '. /usr/libexec/frpc-config-fields', '. ' + FIELDS).replace(
    '. /usr/libexec/frpc-process', '. ' + shlex.quote(str(ROOT / 'root/usr/libexec/frpc-process')))
with tempfile.TemporaryDirectory() as temporary:
    folder = Path(temporary)
    runtime = folder / 'runtime/frpc.toml'
    core = folder / 'frpc'
    core.write_text('''#!/bin/sh
[ "$1" = verify ] && [ "$2" = -c ] || exit 1
grep -q '^valid-' "$3"
''')
    core.chmod(0o755)
    script = source + '\nCONF=' + shlex.quote(str(runtime)) + '\nPROG=' + shlex.quote(str(core)) + r'''
set -e
running=0
stopping=0
stop_delay=0
saved=valid-first
frpc_is_running() {
 if [ "$stopping" = 1 ]; then
  if [ "$stop_delay" -gt 0 ]; then
   stop_delay=$((stop_delay - 1))
  else
   running=0
   stopping=0
  fi
 fi
 [ "$running" = 1 ]
}
sleep() { :; }
stop() { stopping=1; }

service_error() { :; }
mkdir() { [ "$*" = '-p /var/log' ] || command mkdir "$@"; }
config_load() { :; }
generate_config() {
 printf '%s\n' "$saved" > "$CONF"
 chmod 0600 "$CONF"
 [ "$saved" != render-error ]
}
procd_open_instance() { :; }
procd_close_instance() { :; }
procd_set_param() {
 if [ "$1" = command ] && [ "$2" = "$PROG" ]; then
  [ "$3" = -c ] && [ "$4" = "$CONF" ]
  registered=$(cat "$4")
 fi
}
start() { echo 'Unexpected restart' >&2; exit 1; }
start_service
[ "$(cat "$CONF")" = valid-first ]
[ "$registered" = valid-first ]
running=1
saved=valid-next
reload_service
start_service
[ "$(cat "$CONF")" = valid-first ]
[ "$registered" = valid-first ]
# Reproduce procd's asynchronous stop: the old PID remains for two polls.
start() { start_service; }
stop_delay=2
restart
[ "$running" = 0 ]
[ "$stop_delay" = 0 ]
[ "$(cat "$CONF")" = valid-next ]
[ "$registered" = valid-next ]
# A stuck process must fail restart without registering or publishing a new config.
running=1
stop_delay=100
saved=valid-must-not-start
if restart; then exit 1; fi
[ "$(cat "$CONF")" = valid-next ]
[ "$registered" = valid-next ]
running=0
stopping=0
for saved in invalid render-error; do
 if start_service; then exit 1; fi
 [ "$(cat "$CONF")" = valid-next ]
done
[ "$(find "${CONF%/*}" -type f | wc -l)" -eq 1 ]
[ "$(stat -c %a "$CONF")" = 600 ]
'''
    result = subprocess.run(['busybox', 'ash'], input=script, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr

    # Reading either runtime endpoint must never call init or rewrite the snapshot,
    # whether the process is running, stopped, or has never started.
    ui = (ROOT / 'root/usr/libexec/frpc-ui').read_text().replace(
        '. /usr/libexec/frpc-config-fields', '. ' + FIELDS).replace(
    '. /usr/libexec/frpc-process', '. ' + shlex.quote(str(ROOT / 'root/usr/libexec/frpc-process')))
    ui = ui.replace('RAM_ROOT=/tmp/frpc', 'RAM_ROOT=' + shlex.quote(str(folder)))
    init = folder / 'init'
    init.write_text('#!/bin/sh\necho "Unexpected init call" >&2\nexit 1\n')
    init.chmod(0o755)
    ui = ui.replace('INIT=/etc/init.d/frpc', 'INIT=' + shlex.quote(str(init)))
    ui = ui.replace('\nprepare_ram_dirs\n', '\nis_running() { return "${TEST_RUNNING:-1}"; }\nprepare_ram_dirs\n')
    for endpoint in ['read-runtime-config', 'read-config']:
        for running in [0, 1]:
            result = subprocess.run(['busybox', 'ash', '-c',
                                     f'TEST_RUNNING={running}\n' + ui, 'frpc-ui', endpoint],
                                    text=True, capture_output=True)
            assert result.returncode == 0, result.stderr
            assert result.stdout == 'valid-next\n'
            assert runtime.read_text() == 'valid-next\n'
    runtime.unlink()
    result = subprocess.run(['busybox', 'ash', '-c', ui, 'frpc-ui', 'read-runtime-config'],
                            text=True, capture_output=True)
    assert result.returncode == 0 and not result.stdout, result.stderr
    assert not runtime.exists()
print('Runtime snapshots passed: running saves/reload, delayed restart, stop timeout, failed validation, permissions and read-only inspection')

# Use real /proc executable links: an init shell named by pidof is not a client.
with tempfile.TemporaryDirectory() as temporary:
    binary = Path(temporary) / 'frpc'
    subprocess.run(['cc', '-x', 'c', '-o', str(binary), '-'],
                   input='#include <unistd.h>\nint main(void) { for (;;) pause(); }\n', text=True, check=True)
    helper = (ROOT / 'root/usr/libexec/frpc-process').read_text()
    wrapper = subprocess.Popen(['busybox', 'ash', '-c', 'read -r ignored'], stdin=subprocess.PIPE)
    client = None
    try:
        def running(pids):
            script = helper + "\npidof() { printf '%s\\n' " + shlex.quote(' '.join(map(str, pids))) + "; }\n"
            script += 'frpc_is_running ' + shlex.quote(str(binary)) + '\n'
            return subprocess.run(['busybox', 'ash'], input=script, text=True, capture_output=True).returncode == 0
        assert not running([wrapper.pid]), 'Init shell must never count as the frpc binary'
        client = subprocess.Popen([str(binary), '30'])
        assert running([wrapper.pid, client.pid]), 'Real client must be detected alongside an init shell'
        binary.unlink()
        assert running([client.pid]), 'A running binary replaced during upgrade must still be detected'
    finally:
        wrapper.terminate()
        wrapper.communicate()
        if client is not None:
            client.terminate()
            client.wait()
print('Process detection passed: init shell excluded, client detected, replaced executable detected')
