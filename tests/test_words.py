"""Vocabulary/encoding state tests. Temporary accounts only, never personal records."""
import base64
import copy
import gzip
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
from accounts import Accounts, AccountError
from server import UnfoldServer, AIConfig, validate_lesson

PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XWfkAAAAASUVORK5CYII='


def node(args, payload=None):
    result = subprocess.run([os.environ['WORKSPACE_NODE_BIN'], str(ROOT / 'tests/core.cjs'), *args],
                            input=payload, text=True, encoding='utf-8', capture_output=True,
                            check=True, timeout=20)
    return json.loads(result.stdout)


def fixture():
    state = node(['--fixture'])
    state['wordStudy'] = {'V_consider': {
        'en': {'due': '2026-11-22', 'seen': 1, 'streak': 1, 'last': '2026-11-19', 'grade': 'good', 'hinted': False},
        'zh': {'due': '2026-11-20', 'seen': 1, 'streak': 0, 'last': '2026-11-19', 'grade': 'hard', 'hinted': True},
    }}
    state['wordCodes'] = [{'id': 'C_cons', 'fragment': 'cons', 'title': '康熙', 'note': '虚构联想，康熙拿着奏折',
                           'kind': 'fragment', 'rootMeaning': '', 'match': 'any', 'enabled': True,
                           'imageData': PNG, 'created': '2026-11-19', 'updated': '2026-11-19'}]
    return state


class WordStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='unfold-words-state-')
        cls.store = Accounts(cls.tmp.name, lesson_validator=validate_lesson)
        cls.a, _ = cls.store.login({'username': 'words-a', 'password': 'fictional-test-password'}, True, 'a')
        cls.b, _ = cls.store.login({'username': 'words-b', 'password': 'fictional-test-password'}, True, 'b')
        cls.state = fixture()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_both_directions_and_thumbnail_roundtrip(self):
        self.store.push(self.a, {'revision': self.store.pull(self.a)['revision'], 'state': self.state})
        saved = self.store.pull(self.a)['state']
        self.assertEqual(saved['wordStudy'], self.state['wordStudy'])
        self.assertEqual(saved['wordCodes'], self.state['wordCodes'])
        self.assertEqual(node(['--validate'], json.dumps([saved])), [True])

    def test_encoding_and_progress_account_isolation(self):
        self.store.push(self.a, {'revision': self.store.pull(self.a)['revision'], 'state': self.state})
        self.assertIsNone(self.store.pull(self.b)['state'])

    def test_old_backups_without_word_features_remain_readable(self):
        old = copy.deepcopy(self.state)
        for key in ('wordStudy', 'wordCodes'):
            old.pop(key)
        for key in ('wordDirection', 'wordTopic'):
            old['preferences'].pop(key)
        self.assertEqual(node(['--validate'], json.dumps([old])), [True])
        self.store.push(self.a, {'revision': self.store.pull(self.a)['revision'], 'state': old})

    def test_malformed_new_fields_rejected_by_client_and_server(self):
        changes = [
            lambda s: s.update(wordStudy=None),
            lambda s: s.update(wordCodes={}),
            lambda s: s['wordStudy'].update(__proto__=s['wordStudy']['V_consider']),
            lambda s: s['wordStudy']['V_consider'].update(fr=s['wordStudy']['V_consider']['en']),
            lambda s: s['wordStudy']['V_consider']['en'].update(due='2026-02-30'),
            lambda s: s['wordStudy']['V_consider']['en'].update(last='0000-01-01'),
            lambda s: s['wordStudy']['V_consider']['en'].update(seen=True),
            lambda s: s['wordStudy']['V_consider']['en'].update(streak=6),
            lambda s: s['wordStudy']['V_consider']['en'].update(grade='mastered'),
            lambda s: s['wordStudy']['V_consider']['en'].update(hinted='yes'),
            lambda s: s['wordCodes'][0].update(id=None),
            lambda s: s['wordCodes'][0].pop('id'),
            lambda s: s['wordCodes'][0].update(fragment='co-ns'),
            lambda s: s['wordCodes'][0].update(fragment='CONS'),
            lambda s: s['wordCodes'][0].update(title=''),
            lambda s: s['wordCodes'][0].update(kind='automatic-root'),
            lambda s: s['wordCodes'][0].update(imageData='https://example.invalid/private.png'),
            lambda s: s['wordCodes'][0].update(imageData='data:image/svg+xml;base64,PHN2Zz4='),
            lambda s: s['wordCodes'][0].update(imageData=PNG.replace('png', 'jpeg')),
            lambda s: s['wordCodes'][0].update(api_key='synthetic-only'),
            lambda s: s['wordCodes'].append({**s['wordCodes'][0], 'id': 'C_duplicate'}),
            lambda s: s['preferences'].update(wordDirection='fr'),
            lambda s: s['preferences'].update(wordTopic='unknown'),
        ]
        malformed = []
        for change in changes:
            state = copy.deepcopy(self.state)
            change(state)
            malformed.append(state)
        self.assertEqual(node(['--validate'], json.dumps(malformed)), [False] * len(changes))
        for i, state in enumerate(malformed):
            with self.subTest(case=i):
                before = self.store.pull(self.a)
                with self.assertRaises(AccountError):
                    self.store.push(self.a, {'revision': before['revision'], 'state': state})
                self.assertEqual(self.store.pull(self.a), before)

    def test_image_aggregate_quota_does_not_overwrite(self):
        raw = base64.b64decode(PNG.split(',')[1]) + bytes(11000)
        large = 'data:image/png;base64,' + base64.b64encode(raw).decode()
        state = copy.deepcopy(self.state)
        state['wordCodes'] = [{**state['wordCodes'][0], 'id': f'C_{i}',
                               'fragment': 'c' + chr(97 + i // 26) + chr(97 + i % 26),
                               'imageData': large} for i in range(60)]
        before = self.store.pull(self.a)
        with self.assertRaises(AccountError):
            self.store.push(self.a, {'revision': before['revision'], 'state': state})
        self.assertEqual(self.store.pull(self.a), before)
        self.assertEqual(node(['--validate'], json.dumps([state])), [False])

    def test_whole_account_size_limit_stays_two_mib(self):
        state = copy.deepcopy(self.state)
        state['vocabulary'] = [{'id': f'W_{i}', 'term': 'synthetic word', 'meaning': '虚构例子',
                                'context': 'x' * 1500, 'lessonId': 'L01', 'due': '2026-11-19',
                                'seen': 0, 'streak': 0} for i in range(1600)]
        before = self.store.pull(self.a)
        with self.assertRaises(AccountError) as error:
            self.store.push(self.a, {'revision': before['revision'], 'state': state})
        self.assertEqual(error.exception.status, 413)
        self.assertEqual(self.store.pull(self.a), before)


class WordAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='unfold-words-http-')
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

    def test_new_assets_available_with_safe_headers(self):
        for path in ('/word-engine.js', '/words.js', '/word-ui.js', '/words.css'):
            with self.subTest(path=path), self.opener.open(self.origin + path, timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertGreater(len(response.read()), 100)
                self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
                self.assertEqual(response.headers['Cache-Control'], 'no-cache')
                self.assertTrue(response.headers['ETag'])

    def test_static_assets_revalidate_with_304_but_api_stays_no_store(self):
        request = urllib.request.Request(self.origin + '/app.js')
        with self.opener.open(request, timeout=5) as response:
            first = response.read()
            etag = response.headers['ETag']
        self.assertGreater(len(first), 1000)
        self.assertTrue(etag.startswith('"') and etag.endswith('"'))
        revalidated = urllib.request.Request(self.origin + '/app.js', headers={'If-None-Match': etag})
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.opener.open(revalidated, timeout=5)
        self.assertEqual(error.exception.code, 304)
        self.assertEqual(error.exception.headers['Cache-Control'], 'no-cache')
        error.exception.close()
        with self.opener.open(self.origin + '/api/health', timeout=5) as response:
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
        compressed = urllib.request.Request(self.origin + '/app.js', headers={'Accept-Encoding': 'gzip'})
        with self.opener.open(compressed, timeout=5) as response:
            self.assertEqual(response.headers['Content-Encoding'], 'gzip')
            self.assertEqual(response.headers['Vary'], 'Accept-Encoding')
            payload = gzip.decompress(response.read()).decode('utf-8')
        self.assertIn('UnfoldPlayback', payload)

    def test_small_rejected_post_returns_visible_403(self):
        request = urllib.request.Request(self.origin + '/api/account/register', data=b'{}',
                                         headers={'Content-Type': 'application/json', 'X-Unfold-Token': 'invalid-test-token'})
        for _ in range(5):
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.opener.open(request, timeout=5)
            self.assertEqual(error.exception.code, 403)
            self.assertIn('error', json.loads(error.exception.read()))
            error.exception.close()


if __name__ == '__main__':
    unittest.main()
