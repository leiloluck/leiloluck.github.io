#!/usr/bin/env python3
"""normalize_sounds.py — SoundAnnoyer loudness normalizer.

Normalizes every sound file in ../resources/ to a consistent perceived loudness
using ffmpeg's EBU R128 `loudnorm` filter (two-pass, linear). This makes sure no
sound is conspicuously quieter or louder than the others — important when they fire
at random and you can't predict which one comes next.

USAGE
    python tools/normalize_sounds.py          # normalize everything that needs it
    python tools/normalize_sounds.py --check   # report loudness only, change nothing
    python tools/normalize_sounds.py --force   # re-encode even files already on target

WORKFLOW FOR FUTURE FILES
    1. Drop the new .mp3 into resources/ (see resources/README.md for names).
    2. Run this script.
    3. Commit + push.

It is idempotent: files already within TOL of the target are skipped, so re-running
it (or running it after adding one new file) won't degrade the others by repeatedly
re-encoding them.

REQUIRES  ffmpeg + ffprobe on PATH.
"""

import json
import math
import os
import subprocess
import sys
from pathlib import Path

# ── Targets ───────────────────────────────────────────────────────────────────
TARGET_I   = -14.0   # LUFS, integrated loudness (streaming-standard, nice & present)
TARGET_TP  = -1.0    # dBTP, true-peak ceiling (headroom so it never clips)
TARGET_LRA = 11.0    # LU, loudness range
TOL        = 2.0     # LU; skip a file already this close to TARGET_I. Loose enough
                     # that sparse/peaky sounds (which dynamic loudnorm can only get
                     # to within ~1.5 LU) aren't pointlessly re-encoded every run.
MP3_BITRATE = '192k'

AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'}
RESOURCES  = Path(__file__).resolve().parent.parent / 'resources'


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def have_ffmpeg():
    try:
        run(['ffmpeg', '-version'])
        run(['ffprobe', '-version'])
        return True
    except FileNotFoundError:
        return False


def measure(path):
    """First loudnorm pass: returns the measured loudness stats as a dict."""
    r = run(['ffmpeg', '-hide_banner', '-i', str(path),
             '-af', (f'loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}'
                     ':print_format=json'),
             '-f', 'null', '-'])
    out = r.stderr
    start, end = out.rfind('{'), out.rfind('}')
    if start == -1 or end == -1:
        raise RuntimeError(f'could not read loudnorm stats:\n{out[-400:]}')
    return json.loads(out[start:end + 1])


def as_float(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def normalize(path, stats):
    """Second loudnorm pass: re-encode to target loudness, replace in place."""
    # Dynamic mode (linear=false): unlike linear scaling, this can still reach the
    # target loudness for peaky / low-average content (crickets, mosquito, a phone
    # buzz) where a single linear gain would be capped by the true-peak ceiling.
    af = (f'loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}'
          f':measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}'
          f':measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}'
          f':offset={stats["target_offset"]}:linear=false:print_format=summary')

    tmp = path.with_name(path.stem + '.__norm__.mp3')
    r = run(['ffmpeg', '-hide_banner', '-y', '-i', str(path),
             '-af', af, '-ar', '44100', '-ac', '1',
             '-c:a', 'libmp3lame', '-b:a', MP3_BITRATE, str(tmp)])
    if r.returncode != 0 or not tmp.exists():
        if tmp.exists():
            tmp.unlink()
        raise RuntimeError(f'ffmpeg failed:\n{r.stderr[-400:]}')

    # If the source wasn't already .mp3, drop the old extension version.
    os.replace(str(tmp), str(path.with_suffix('.mp3')))
    if path.suffix.lower() != '.mp3' and path.exists():
        path.unlink()


def main():
    check = '--check' in sys.argv
    force = '--force' in sys.argv

    if not have_ffmpeg():
        sys.exit('ERROR: ffmpeg/ffprobe not found on PATH. Install ffmpeg first.')

    files = sorted(p for p in RESOURCES.iterdir()
                   if p.is_file() and p.suffix.lower() in AUDIO_EXTS)
    if not files:
        print(f'No audio files in {RESOURCES}')
        return

    print(f'Target: {TARGET_I} LUFS (+/-{TOL}), peak <= {TARGET_TP} dBTP\n')
    print(f'{"file":<24}{"before":>12}{"after/now":>12}   action')
    print('-' * 62)

    changed = 0
    for p in files:
        try:
            stats = measure(p)
        except Exception as e:
            print(f'{p.name:<24}{"?":>12}{"":>12}   SKIP ({e})')
            continue

        before = as_float(stats.get('input_i'))
        before_s = f'{before:.1f}' if before is not None else 'n/a'

        on_target = before is not None and abs(before - TARGET_I) <= TOL
        if before is None:
            print(f'{p.name:<24}{before_s:>12}{"":>12}   SKIP (silent/unreadable)')
            continue

        if on_target and not force:
            print(f'{p.name:<24}{before_s:>12}{before_s:>12}   ok (within +/-{TOL})')
            continue

        if check:
            print(f'{p.name:<24}{before_s:>12}{"":>12}   WOULD NORMALIZE')
            continue

        normalize(p, stats)
        after = as_float(measure(p.with_suffix('.mp3')).get('input_i'))
        after_s = f'{after:.1f}' if after is not None else 'n/a'
        print(f'{p.name:<24}{before_s:>12}{after_s:>12}   normalized')
        changed += 1

    print('-' * 62)
    if check:
        print('check only - nothing changed.')
    else:
        print(f'done - {changed} file(s) normalized, {len(files) - changed} already ok.')


if __name__ == '__main__':
    main()
