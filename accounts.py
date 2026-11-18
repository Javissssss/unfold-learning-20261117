"""Account-scoped durable storage. No third-party packages; data stays outside source.
Deploy the same service behind HTTPS with a persistent volume for cross-device sync.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from contextlib import contextmanager
from learning_state import validate_learning

MAX_STATE = 2 * 1024 * 1024
USERNAME = re.compile(r"[A-Za-z0-9_-]{3,40}\Z")

class AccountError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

class Accounts:
    def __init__(self, directory=None, lesson_validator=None):
        self.lesson_validator = lesson_validator
        default = Path(os.environ.get('LOCALAPPDATA', Path.home() / '.local' / 'share')) / 'Unfold'
        self.directory = Path(directory or os.environ.get('UNFOLD_DATA_DIR', default)).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / 'accounts.sqlite3'
        self.lock = threading.RLock()
        with self.db() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
                    salt TEXT NOT NULL, password TEXT NOT NULL, created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL,
                    expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS learning (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
                    state TEXT NOT NULL, updated REAL NOT NULL);
            ''')
        self.attempts = {}

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=15)
        try:
            db.execute('PRAGMA busy_timeout=15000')
            with db:
                yield db
        finally:
            db.close()

    def password_hash(self, password, salt):
        return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=64).hex()

    def throttle(self, client):
        now = time.monotonic()
        with self.lock:
            self.attempts = {k: [t for t in v if now-t < 300] for k,v in self.attempts.items() if v and now-v[-1] < 300}
            attempts = self.attempts.setdefault(client, [])
            if len(attempts) >= 15:
                raise AccountError('登录尝试过多，请五分钟后重试。', 429)
            attempts.append(now)

    def credentials(self, body):
        name, password = body.get('username'), body.get('password')
        if not isinstance(name, str) or not USERNAME.fullmatch(name):
            raise AccountError('账号请用3—40位字母、数字、下划线或短横线。')
        if not isinstance(password, str) or not 10 <= len(password) <= 128:
            raise AccountError('密码须为10—128个字符。')
        return name.lower(), password

    def authenticate(self, token):
        if not token or len(token) > 100:
            return None
        hashed = hashlib.sha256(token.encode()).hexdigest()
        with self.db() as db:
            row = db.execute('SELECT u.id,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?', (hashed,time.time())).fetchone()
        return {'id':row[0], 'username':row[1]} if row else None

    def login(self, body, register, client):
        self.throttle(client)
        name, password = self.credentials(body)
        with self.lock, self.db() as db:
            if register:
                salt = secrets.token_hex(16)
                try:
                    db.execute('INSERT INTO users VALUES (?,?,?,?,?)', (secrets.token_hex(16),name,salt,self.password_hash(password,salt),time.time()))
                except sqlite3.IntegrityError:
                    raise AccountError('这个账号已被使用，请换一个账号或登录。',409) from None
            row = db.execute('SELECT id,salt,password FROM users WHERE name=?', (name,)).fetchone()
            # A dummy computation avoids fast missing-account responses.
            digest = self.password_hash(password, row[1] if row else '00'*16)
            if not row or not hmac.compare_digest(digest, row[2]):
                raise AccountError('账号或密码不正确。',401)
            token = secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES (?,?,?)', (hashlib.sha256(token.encode()).hexdigest(),row[0],time.time()+7*86400))
        return {'id':row[0],'username':name},token

    def logout(self, token):
        with self.db() as db:
            db.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(token.encode()).hexdigest(),))

    def change_password(self, user, body):
        old, new = body.get('current_password',''), body.get('new_password','')
        if not isinstance(old,str) or len(old)>128 or not isinstance(new,str) or not 10<=len(new)<=128:
            raise AccountError('新密码须为10—128个字符。')
        with self.lock, self.db() as db:
            row=db.execute('SELECT salt,password FROM users WHERE id=?',(user['id'],)).fetchone()
            if not row or not hmac.compare_digest(self.password_hash(old,row[0]),row[1]):
                raise AccountError('当前密码不正确。',401)
            salt=secrets.token_hex(16)
            db.execute('UPDATE users SET salt=?,password=? WHERE id=?',(salt,self.password_hash(new,salt),user['id']))
            db.execute('DELETE FROM sessions WHERE user_id=?',(user['id'],))

    def pull(self, user):
        with self.db() as db:
            row=db.execute('SELECT revision,state,updated FROM learning WHERE user_id=?',(user['id'],)).fetchone()
        return {'revision':row[0], 'state':json.loads(row[1]), 'updated':row[2]} if row else {'revision':0,'state':None,'updated':None}

    def push(self, user, body):
        state, revision = body.get('state'), body.get('revision')
        if type(revision) is not int or revision<0 or not isinstance(state,dict) or state.get('version')!=1:
            raise AccountError('同步数据结构或版本无效。')
        try:
            validate_learning(state, self.lesson_validator)
            raw=json.dumps(state,ensure_ascii=False,separators=(',',':'),allow_nan=False)
        except (ValueError, TypeError, KeyError, OverflowError):
            raise AccountError('学习记录格式不合法，未保存；原账号记录保留。') from None
        if len(raw.encode())>MAX_STATE:
            raise AccountError('学习记录超过2MB，请先导出和整理。',413)
        # Parameters only; every read/write is scoped to the authenticated user.
        with self.lock, self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT revision FROM learning WHERE user_id=?',(user['id'],)).fetchone()
            current=row[0] if row else 0
            if current!=revision:
                raise AccountError('另一台设备更新了记录，已暂停覆盖。请先处理同步冲突。',409)
            updated=time.time()
            db.execute('INSERT INTO learning VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,state=excluded.state,updated=excluded.updated',(user['id'],current+1,raw,updated))
        return {'revision':current+1,'updated':updated}
