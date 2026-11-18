"""Run: WORKSPACE_PYTHON_BIN -B -m unittest discover -s tests -v.
All accounts live in TemporaryDirectory; never touches the user's database.
Requires WORKSPACE_NODE_BIN (Node 22+) for client/server protocol parity.
"""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from accounts import AccountError, Accounts
from server import UnfoldServer, AIConfig, validate_lesson


def node(args, payload=None):
    entry = os.environ['WORKSPACE_NODE_BIN']
    return subprocess.run([entry, str(ROOT / 'tests/core.cjs'), *args], input=payload, text=True,
                          encoding='utf-8', capture_output=True, check=True, timeout=20).stdout


class DurableStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='unfold-regression-')
        cls.store = Accounts(cls.tmp.name, lesson_validator=validate_lesson)
        cls.fixture = json.loads(node(['--fixture']))
        cls.a, cls.token = cls.store.login({'username': 'test-a', 'password': 'regression-only-password'}, True, 'a')
        cls.b, _ = cls.store.login({'username': 'test-b', 'password': 'regression-only-password'}, True, 'b')

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_valid_state_and_client_roundtrip(self):
        result = self.store.push(self.a, {'revision': self.store.pull(self.a)['revision'], 'state': self.fixture})
        remote = self.store.pull(self.a)
        self.assertEqual(remote['revision'], result['revision'])
        self.assertEqual(json.loads(node(['--validate'], json.dumps([remote['state']]))), [True])

    def test_user_isolation(self):
        self.store.push(self.a, {'revision': self.store.pull(self.a)['revision'], 'state': self.fixture})
        self.assertIsNone(self.store.pull(self.b)['state'])

    def test_concurrent_revision_conflict(self):
        revision = self.store.pull(self.a)['revision']
        self.store.push(self.a, {'revision': revision, 'state': self.fixture})
        with self.assertRaises(AccountError) as error:
            self.store.push(self.a, {'revision': revision, 'state': self.fixture})
        self.assertEqual(error.exception.status, 409)

    def test_bad_inputs_never_replace_saved_record(self):
        changes = [
            ('vocabulary null', lambda s: s.update(vocabulary=None)),
            ('vocabulary string', lambda s: s.update(vocabulary='wrong')),
            ('AI history null', lambda s: s.update(aiHistory=None)),
            ('answer out of range', lambda s: s['progress']['L01'].update(answers=[9, None, None, None])),
            ('progress array', lambda s: s['progress'].update(L01=[])),
            ('completion absent', lambda s: s['progress']['L01'].pop('completedAt')),
            ('bad completion', lambda s: s['progress']['L01'].update(completedAt='not-a-date')),
            ('bad ranges', lambda s: s['progress']['L01'].update(audioRanges=[[1, 0]])),
            ('NaN position', lambda s: s['progress']['L01'].update(audioPosition=float('nan'))),
            ('bad due date', lambda s: s['reviews'][0].update(due='2026-02-30')),
            ('duplicate reviews', lambda s: s['reviews'].append(s['reviews'][0].copy())),
            ('duplicate vocabulary', lambda s: s['vocabulary'].append(s['vocabulary'][0].copy())),
            ('empty word', lambda s: s['vocabulary'][0].update(term='')),
            ('draft object', lambda s: s['drafts'].update(L01={})),
            ('unsafe identifier', lambda s: s['drafts'].update(__proto__='x')),
            ('bad rate', lambda s: s['preferences'].update(rate=2)),
            ('invalid material', lambda s: s['generated'][0].update(script='')),
            ('duplicate material', lambda s: s['generated'].append(s['generated'][0].copy())),
            ('non-learning secret field', lambda s: s.update(api_key='synthetic-test-value')),
            ('oversized drafts count', lambda s: s.update(drafts={f'L{i}': '' for i in range(301)})),
        ]
        for name, change in changes:
            with self.subTest(case=name):
                before = self.store.pull(self.a)
                malformed = copy.deepcopy(self.fixture)
                change(malformed)
                with self.assertRaises(AccountError):
                    self.store.push(self.a, {'revision': before['revision'], 'state': malformed})
                self.assertEqual(self.store.pull(self.a), before)

    def test_legacy_record_without_new_optional_fields(self):
        old = copy.deepcopy(self.fixture)
        del old['vocabulary']
        for key in ('voicePack', 'volume', 'theme', 'autoNext'):
            old['preferences'].pop(key)
        for key in ('audioPosition', 'audioRanges', 'audioRevision', 'completion', 'stage', 'mode', 'firstAnswers', 'listenContext', 'listenChecked', 'readingChecked', 'supportUsed', 'speakingDone', 'writingDone'):
            old['progress']['L01'].pop(key)
        self.store.push(self.a, {'revision': self.store.pull(self.a)['revision'], 'state': old})
        self.assertEqual(json.loads(node(['--validate'], json.dumps([old]))), [True])

    def test_logout_revokes_session(self):
        user, token = self.store.login({'username': 'test-session', 'password': 'regression-only-password'}, True, 'session')
        self.assertEqual(self.store.authenticate(token), user)
        self.store.logout(token)
        self.assertIsNone(self.store.authenticate(token))


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='unfold-http-')
        old = os.environ.get('UNFOLD_DATA_DIR')
        os.environ['UNFOLD_DATA_DIR'] = cls.tmp.name
        try:
            cls.server = UnfoldServer(('127.0.0.1', 0), config=AIConfig())
        finally:
            if old is None:
                os.environ.pop('UNFOLD_DATA_DIR', None)
            else:
                os.environ['UNFOLD_DATA_DIR'] = old
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.tmp.cleanup()

    def request(self, path, headers=None, data=None):
        req = urllib.request.Request(self.origin + path, headers=headers or {}, data=data)
        try:
            return self.opener.open(req, timeout=5)
        except urllib.error.HTTPError as response:
            return response

    def test_all_74_audio_files_and_ranges(self):
        for pack in ('a', 'b'):
            for lesson in [f'L{i:02}' for i in range(1, 37)] + ['_preview']:
                with self.subTest(pack=pack, lesson=lesson):
                    with self.request(f'/audio/{pack}/{lesson}.wav', {'Range': 'bytes=0-43'}) as r:
                        self.assertEqual(r.status, 206)
                        raw = r.read()
                        self.assertEqual(len(raw), 44)
                        self.assertEqual(raw[:4], b'RIFF')
                        self.assertEqual(raw[8:12], b'WAVE')
                        self.assertEqual(r.headers['Accept-Ranges'], 'bytes')

    def test_missing_audio_and_bad_range(self):
        with self.request('/audio/a/does-not-exist.wav') as r:
            self.assertEqual(r.status, 404)
        with self.request('/audio/a/L01.wav', {'Range': 'bytes=999999999-'}) as r:
            self.assertEqual(r.status, 416)

    def test_csrf_rejects_before_write(self):
        with self.request('/api/account/register', {'Content-Type': 'application/json', 'X-Unfold-Token': 'synthetic-invalid'}, b'{}') as r:
            self.assertEqual(r.status, 403)
        self.assertEqual(self.server.accounts.pull({'id': 'unknown'})['revision'], 0)

    def test_unauthenticated_sync_is_rejected(self):
        with self.request('/api/sync') as r:
            self.assertEqual(r.status, 401)

    def test_all_72_sentence_timelines(self):
        lessons = json.loads((ROOT / 'lessons.json').read_text(encoding='utf-8')) + json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))
        for pack in ('a', 'b'):
            table = json.loads((ROOT / f'audio/{pack}/timings.json').read_text(encoding='utf-8'))
            for lesson in lessons:
                with self.subTest(pack=pack, lesson=lesson['id']):
                    entry = table[lesson['id']]
                    self.assertEqual(len(entry['timing']), len([line for line in lesson['script'].splitlines() if ':' in line]))
                    previous = 0
                    for start, end in entry['timing']:
                        self.assertGreaterEqual(start, previous)
                        self.assertGreater(end, start)
                        previous = end


if __name__ == '__main__':
    unittest.main()
