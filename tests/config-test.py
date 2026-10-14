#!/usr/bin/env python3
"""Exercise generated TOML with real frpc verification, without a router or server."""
import json
import os
import shlex
import subprocess
import tempfile
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = Path(os.environ.get('FRPC_TEST_CORE', ROOT / '.build-cache/frpc-test/frpc'))
BASE = dict(enabled='1', server_addr='example.org', server_port='7000', user='',
            auth_mode='auth', token='test-only', tls_enable='true', login_fail_exit='true',
            log_level='info', log_max_days='3')


def generate(main=None, proxies=None, visitors=None, verify=True):
    sections = {'main': BASE | (main or {})}
    groups = {'proxy': [], 'visitor': []}
    for group, entries in [('proxy', proxies or []), ('visitor', visitors or [])]:
        for i, entry in enumerate(entries):
            sid = f'{group}{i}'
            sections[sid] = entry
            groups[group].append(sid)
    with tempfile.TemporaryDirectory() as temporary:
        folder = Path(temporary)
        source = (ROOT / 'root/etc/init.d/frpc').read_text().replace(
            '. /usr/libexec/frpc-config-fields',
            '. ' + shlex.quote(str(ROOT / 'root/usr/libexec/frpc-config-fields')))
        source = '\n'.join(source.splitlines()[1:])
        config = folder / 'generated.toml'
        cases = '\n'.join(f'{shlex.quote(sid+":"+key)}) config_result={shlex.quote(value)} ;;'
                          for sid, fields in sections.items() for key, value in fields.items())
        script = source + '\n' + '''
config_load() { :; }
config_get() {
 local target="$1" sid="$2" config_key="$3" config_result="${4:-}"
 case "$sid:$config_key" in
''' + cases + '''
 esac
 export "$target=$config_result"
}
config_foreach() {
 case "$2" in
''' + '\n'.join(f'{group}) ' + '; '.join(f'"$1" {sid}' for sid in ids) + (' ;;' if ids else ': ;;')
                 for group, ids in groups.items()) + '''
 esac
}
CONF=''' + shlex.quote(str(config)) + '\ngenerate_config\n'
        result = subprocess.run(['busybox', 'ash'], input=script, text=True, capture_output=True)
        assert result.returncode == 0, result.stderr
        parsed = tomllib.loads(config.read_text())
        if verify:
            result = subprocess.run([str(CORE), 'verify', '-c', str(config)], text=True, capture_output=True)
            assert result.returncode == 0, result.stdout + result.stderr
        return parsed


p = dict(name='web', type='http', local_ip='127.0.0.1', local_port='8080',
         custom_domains='example.org', http_user='alice', http_password='test-only',
         route_http_user='alice', locations='/api,/admin', host_rewrite='backend.local',
         request_headers='X-Example=a=b\nX-Other=quoted "value"', response_headers='X-Reply=ok',
         bandwidth_limit='1MB', bandwidth_mode='client', lb_group='web', lb_key='test-only',
         health_type='http', health_path='/health', health_timeout='3', health_interval='10',
         health_failed='2', proxy_protocol='v2')
c = generate({'protocol': 'quic', 'quic_keepalive': '10', 'quic_idle': '30',
              'quic_streams': '100', 'heartbeat_interval': '-1', 'pool_count': '03',
              'tcp_mux': 'true', 'mux_keepalive': '30', 'dial_timeout': '10',
              'auth_scopes': 'HeartBeats,NewWorkConns'}, [p])
assert c['transport']['protocol'] == 'quic' and c['transport']['poolCount'] == 3
assert c['transport']['heartbeatInterval'] == -1
assert c['auth']['additionalScopes'] == ['HeartBeats', 'NewWorkConns']
assert c['proxies'][0]['requestHeaders']['set']['X-Example'] == 'a=b'
assert c['proxies'][0]['healthCheck']['path'] == '/health'
assert c['proxies'][0]['transport']['bandwidthLimit'] == '1MB'

v = dict(name='visit', type='xtcp', server_name='private', secret_key='test-only', bind_port='-1',
         xtcp_protocol='kcp', xtcp_retries='8', xtcp_retry_interval='90',
         fallback_to='backup', fallback_timeout='1000', nat_disable_assisted='true')
backup = dict(name='backup', type='stcp', server_name='private', secret_key='test-only', bind_port='-1')
c = generate(visitors=[v, backup])
assert c['visitors'][0]['protocol'] == 'kcp' and c['visitors'][0]['bindPort'] == -1
assert c['visitors'][0]['fallbackTo'] == 'backup'

for plugin, extra in [
    ('http_proxy', {'plugin_http_user':'user','plugin_http_password':'test-only'}),
    ('socks5', {'plugin_username':'user','plugin_password':'test-only'}),
    ('static_file', {'plugin_path':'/tmp','plugin_strip':'/files'}),
    ('unix_domain_socket', {'plugin_unix':'/tmp/example.sock'}),
    ('http2https', {'plugin_addr':'127.0.0.1:443','plugin_host':'example.org'}),
    ('https2http', {'plugin_addr':'127.0.0.1:80','plugin_http2':'true'}),
    ('https2https', {'plugin_addr':'127.0.0.1:443'}),
    ('tls2raw', {'plugin_addr':'127.0.0.1:22'})]:
    c = generate(proxies=[dict(name='plugin',type='tcp',remote_port='23000',plugin_type=plugin) | extra])
    assert c['proxies'][0]['plugin']['type'] == plugin
    assert 'localPort' not in c['proxies'][0]

c = generate({'auth_mode':'oidc','token':'','oidc_client_id':'id','oidc_client_secret':'test-only',
              'oidc_endpoint':'https://example.org/token','oidc_audience':'frp','oidc_scope':'openid',
              'tls_server_name':'frp.example.org'})
assert c['auth']['method'] == 'oidc' and 'token' not in c['auth']
assert c['auth']['oidc']['clientID'] == 'id'
with tempfile.NamedTemporaryFile(mode='w') as token:
    token.write('test-only'); token.flush()
    c = generate({'token_file':token.name})
    assert 'token' not in c['auth'] and c['auth']['tokenSource']['file']['path'] == token.name
c = generate({'auth_mode':'metadatas'}, [dict(name='off',type='tcp',enabled='0')])
assert c['metadatas']['token'] == 'test-only' and 'proxies' not in c
c = generate({'protocol':'tcp','quic_idle':'99'}, [dict(name='tcp',type='tcp',local_port='22',remote_port='20022',http_user='unused')])
assert 'quic' not in c['transport'] and 'httpUser' not in c['proxies'][0]
print('Generated TOML passed: global transport, HTTP, XTCP fallback, 8 plugins, OIDC, token file, disabled proxies and hidden fields')
