"""Validate durable learning records before committing; no secrets or media belong here."""
from __future__ import annotations
import math
import re
from datetime import date, datetime

ID = re.compile(r'(?!__proto__$|constructor$|prototype$)[A-Za-z0-9_-]{1,60}\Z')
CONTEXTS = {'unrecorded', 'independent', 'supported', 'not-listened'}
THEMES = set('meetings projects communication business daily social travel food culture science relationships ideas news health tech learning money environment home sport family career cities'.split())


def require(condition, message='学习记录格式不合法。'):
    if not condition:
        raise ValueError(message)


def identifier(value):
    return isinstance(value, str) and bool(ID.fullmatch(value))


def integer(value, low=0, high=100000):
    return type(value) is int and low <= value <= high


def text(value, limit, nonempty=False):
    return isinstance(value, str) and len(value) <= limit and (not nonempty or bool(value.strip()))


def finite(value, low=0, high=7200):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def valid_date(value):
    if not isinstance(value, str):
        return False
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def answers(value):
    return isinstance(value, list) and len(value) == 4 and all(x is None or integer(x, 0, 2) for x in value)


def validate_learning(state, lesson_validator=None):
    require(isinstance(state, dict) and type(state.get('version')) is int and state['version'] == 1)
    required = {'progress': dict, 'reviews': list, 'journals': list, 'drafts': dict, 'generated': list, 'preferences': dict}
    require(not set(state) - (set(required) | {'version', 'lastLesson', 'vocabulary', 'aiHistory'}), '同步数据包含非学习字段，拒绝保存。')
    for key, kind in required.items():
        require(isinstance(state.get(key), kind), f'{key}格式不合法。')
    for key, limit in {'progress': 500, 'reviews': 1000, 'journals': 1000, 'drafts': 300, 'generated': 200, 'vocabulary': 3000, 'aiHistory': 200}.items():
        values = state.get(key, [])
        require(isinstance(values, dict if key in ('progress', 'drafts') else list) and len(values) <= limit, f'{key}格式或数量不合法。')
    if 'lastLesson' in state:
        require(identifier(state['lastLesson']))
    generated_ids = set()
    for lesson in state['generated']:
        require(isinstance(lesson, dict) and identifier(lesson.get('id')) and lesson['id'].startswith('G_'))
        require(lesson['id'] not in generated_ids, '扩展材料标识重复。')
        generated_ids.add(lesson['id'])
        require(lesson_validator is not None, '材料校验入口未配置。')
        lesson_validator(lesson)
    for key, p in state['progress'].items():
        require(identifier(key) and isinstance(p, dict) and answers(p.get('answers')))
        require(all(type(p.get(k)) is bool for k in ('heard', 'read', 'checked')))
        for k in ('replays', 'chineseHints', 'transcriptOpened'):
            require(integer(p.get(k)))
        require(integer(p.get('hintLevel'), 0, 3) and integer(p.get('stage', 0), 0, 2))
        mode = p.get('mode', 'both')
        require(mode in ('both', 'reading') and p.get('listenContext', 'unrecorded') in CONTEXTS)
        for k in ('listenChecked', 'readingChecked', 'supportUsed', 'speakingDone', 'writingDone'):
            require(k not in p or type(p[k]) is bool)
        require(answers(p.get('firstAnswers', [None] * 4)))
        required_answers = p['answers'][2:] if mode == 'reading' else p['answers']
        require(not p['checked'] or all(x is not None for x in required_answers))
        require(not p.get('listenChecked', False) or all(x is not None for x in p['answers'][:2]))
        require(not p.get('readingChecked', False) or all(x is not None for x in p['answers'][2:]))
        require(finite(p.get('audioPosition', 0)))
        revision = p.get('audioRevision', '')
        require(text(revision, 60) and bool(re.fullmatch(r'[-a-zA-Z0-9_]{0,60}', revision)))
        ranges = p.get('audioRanges', [])
        require(isinstance(ranges, list) and len(ranges) <= 64)
        last = 0
        for r in ranges:
            require(isinstance(r, list) and len(r) == 2 and all(finite(x) for x in r) and r[1] > r[0] and r[0] >= last)
            last = r[1]
        require('completedAt' in p)
        completed = p['completedAt']
        if completed is not None:
            require(text(completed, 80, True) and p['read'])
            try:
                datetime.fromisoformat(completed.replace('Z', '+00:00'))
            except ValueError:
                require(False)
            past = p.get('completion') or {'mode': mode, 'answers': p['answers'], 'context': p.get('listenContext', 'unrecorded')}
            require(isinstance(past, dict) and past.get('mode') in ('both', 'reading') and answers(past.get('answers')) and past.get('context') in CONTEXTS)
            require(all(x is not None for x in (past['answers'][2:] if past['mode'] == 'reading' else past['answers'])))
            require(past['mode'] != 'both' or p['heard'])
            require(p.get('completion') is not None or p['checked'])
        else:
            require(p.get('completion') is None)
    seen_reviews = set()
    for r in state['reviews']:
        require(isinstance(r, dict) and identifier(r.get('lessonId')) and integer(r.get('phraseIndex'), 0, 4) and valid_date(r.get('due')) and integer(r.get('seen')) and integer(r.get('streak', 0), 0, 5))
        key = (r['lessonId'], r['phraseIndex'])
        require(key not in seen_reviews, '复习条目重复。')
        seen_reviews.add(key)
    for collection in ('vocabulary', 'journals'):
        seen = set()
        for entry in state.get(collection, []):
            require(isinstance(entry, dict) and identifier(entry.get('id')) and entry['id'] not in seen)
            seen.add(entry['id'])
            if collection == 'vocabulary':
                require(text(entry.get('term'), 80, True) and text(entry.get('meaning'), 500) and text(entry.get('context'), 1500) and identifier(entry.get('lessonId')))
                # Older clients omit scheduling fields; valid defaults remain readable.
                if 'due' in entry:
                    require(valid_date(entry['due']))
                require(integer(entry.get('seen', 0)) and integer(entry.get('streak', 0), 0, 5))
            else:
                require(valid_date(entry.get('date')) and entry.get('scenario') in THEMES and integer(entry.get('rating'), 1, 5) and text(entry.get('note'), 280))
    require(all(identifier(key) and text(value, 1800) for key, value in state['drafts'].items()))
    pref = state['preferences']
    require(finite(pref.get('rate'), 0.75, 1.3) and pref['rate'] in (0.75, 0.9, 1, 1.15, 1.3))
    require('voice' not in pref or text(pref['voice'], 500))
    require('volume' not in pref or finite(pref['volume'], 0, 1))
    for key, choices in {'voicePack': ('a', 'b'), 'textSize': ('small', 'standard', 'large'), 'theme': ('auto', 'light', 'dark')}.items():
        require(key not in pref or pref[key] in choices)
    require('autoNext' not in pref or type(pref['autoNext']) is bool)
    # Legacy AI history is accepted only as bounded text records, never API configuration.
    for entry in state.get('aiHistory', []):
        require(isinstance(entry, dict) and not set(entry) - {'role', 'text'} and entry.get('role') in ('learner', 'partner') and text(entry.get('text'), 3500))
    return state
