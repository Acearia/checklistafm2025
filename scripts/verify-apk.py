"""Verify packaged web assets without printing embedded public credentials."""
import base64
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile

apk = Path(sys.argv[1])
with ZipFile(apk) as bundle:
    assert bundle.testzip() is None, 'Corrupted APK'
    names = set(bundle.namelist())
    config = json.loads(bundle.read('assets/capacitor.config.json'))
    assert config['appId'] == 'br.com.afm.checklist'
    assert not config.get('server', {}).get('url'), 'Offline assets must be local'
    assert config.get('server', {}).get('androidScheme') == 'https'
    assert config.get('server', {}).get('hostname', 'localhost') == 'localhost', 'Preserve existing offline data origin'
    assert config['android']['webContentsDebuggingEnabled'] is False
    assert config['android']['allowMixedContent'] is False
    metadata = json.loads(bundle.read('assets/public/apk-build.json'))
    html = bundle.read('assets/public/index.html').decode('utf-8')
    for asset in re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html):
        assert 'assets/public' + asset in names, 'Missing entry asset'
    scripts = [name for name in names if name.startswith('assets/public/') and name.endswith('.js')]
    content = '\n'.join(bundle.read(name).decode('utf-8') for name in scripts)
    for marker in ['ti-dashboard-month', 'checklistafm-ti-theme', 'environmental-question-plan']:
        assert marker in content, 'Missing current feature: ' + marker
    assert not re.search(r'sb_secret_[A-Za-z0-9_-]{20,}', content), 'Private Supabase key found'
    for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', content):
        try:
            payload = json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '==='))
        except (ValueError, UnicodeDecodeError):
            continue
        assert payload.get('role') != 'service_role', 'Private service credential found'
print(json.dumps({'version': metadata, 'bytes': apk.stat().st_size, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'web_bundles': len(scripts)}, indent=2))
