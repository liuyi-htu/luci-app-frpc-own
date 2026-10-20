#!/usr/bin/env python3
"""Exercise authentication validation and service guards without changing router UCI."""
import json
import re
import shlex
import subprocess
import tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'root/usr/libexec/frpc-ui').read_text().split('\nprepare_ram_dirs\n', 1)[0]
source = source.replace('. /usr/libexec/frpc-config-fields', '. '+shlex.quote(str(ROOT / 'root/usr/libexec/frpc-config-fields')))
source = source.replace('. /usr/libexec/frpc-process', '. '+shlex.quote(str(ROOT / 'root/usr/libexec/frpc-process')))
fields = re.search(r"main_advanced_fields='([^']+)'", (ROOT / 'root/usr/libexec/frpc-config-fields').read_text())[1].split()
base = dict.fromkeys((f.split(':')[0] for f in fields), '')
base.update(server_addr='example.org',server_port='7000',user='',auth_mode='auth',token='test-only',
            tls_enable='true',login_fail_exit='true',log_level='info',log_max_days='3')

def save(data, running=False):
    with tempfile.TemporaryDirectory() as temporary:
        folder=Path(temporary); upload=folder/'auth.json'; log=folder/'writes'
        upload.write_text(json.dumps(base | data))
        jsonfilter=folder/'jsonfilter'
        jsonfilter.write_text('''#!/usr/bin/env python3
import json,sys
args=sys.argv[1:]
data=json.load(open(args[args.index('-i')+1]))
key=args[args.index('-e')+1][2:]
if key not in data: sys.exit(1)
print(data[key])
'''); jsonfilter.chmod(0o755)
        script=source+'\nAUTH_UPLOAD='+shlex.quote(str(upload))+'\nPATH='+shlex.quote(str(folder))+':"$PATH"\n'
        script+='\nis_running() { return '+('0' if running else '1')+'; }\n'
        script+='uci() { printf \'%s\\n\' "$*" >> '+shlex.quote(str(log))+'; }\nsave_authentication\n'
        result=subprocess.run(['busybox','ash'],input=script,text=True,capture_output=True)
        return result.returncode, log.read_text() if log.exists() else '', result.stderr

code,writes,_=save({'protocol':'quic','pool_count':'4','heartbeat_interval':'-1'})
assert code==0 and 'frpc.main.protocol=quic' in writes and 'delete frpc.main.oidc_client_secret' in writes
for invalid in [{'protocol':'invalid'}, {'pool_count':'-2'}, {'heartbeat_interval':'-2'},
                {'token':''}, {'server_port':'70000'}, {'tls_no_first_byte':'invalid'},
                {'server_addr':'bad\naddress'}, {'auth_mode':'oidc'}, {'oidc_client_secret':'bad\nsecret'}]:
    code,writes,_=save(invalid)
    assert code!=0 and not writes, invalid
code,writes,_=save({'token':'','token_file':'/etc/frpc.token'})
assert code==0 and 'delete frpc.main.token' in writes
code,writes,_=save({'auth_mode':'oidc','token':'','oidc_client_id':'id','oidc_client_secret':'test-only','oidc_endpoint':'https://example.org/token'})
assert code==0 and 'frpc.main.auth_mode=oidc' in writes
code,writes,_=save({},running=True)
assert code==0 and 'commit frpc' in writes
print('Authentication whitelist, optional deletion, numeric/enumeration validation, OIDC/token-file and saving while running passed')
