#!/usr/bin/env python3
"""Procedural demo-music generator for the Atmosfera diary demo.

Creates 7 short ORIGINAL tracks (mono, 22050 Hz, 16-bit, 30 s) in demo/audio/.
Everything is synthesised from scratch (additive / FM synthesis + filtered
noise drums), so the output is free of third-party rights and released under
CC0.  Tempo, key/mode and energy are deliberately made easy to detect:
percussive or plucked onsets sit exactly on the beat, bass plays chord roots,
chords/melody stay in the key.

Usage:  python tools/make_demo_music.py
Requires: numpy
"""
from __future__ import annotations

import math
import os
import wave

import numpy as np

SR = 22050
DUR = 30.0
N = int(SR * DUR)
PEAK_DBFS = -3.0
FADE_IN = 1.0
FADE_OUT = 2.0

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "demo", "audio"))

RNG = np.random.default_rng(20261121)

MAJOR = [0, 2, 4, 5, 7, 9, 11]
MINOR = [0, 2, 3, 5, 7, 8, 10]
QUAL = {
    "maj": [0, 4, 7],
    "min": [0, 3, 7],
    "maj7": [0, 4, 7, 11],
    "m7": [0, 3, 7, 10],
    "7": [0, 4, 7, 10],
}


# --------------------------------------------------------------------------
# DSP helpers
# --------------------------------------------------------------------------
def mtof(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def fft_filter(x: np.ndarray, lo: float | None = None, hi: float | None = None,
               order: int = 2) -> np.ndarray:
    """Zero-phase Butterworth-magnitude band filter done in the FFT domain."""
    n = len(x)
    if n == 0:
        return x
    nfft = 1 << int(math.ceil(math.log2(n + 2048)))
    spec = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1.0 / SR)
    h = np.ones_like(f)
    if hi:
        h *= 1.0 / np.sqrt(1.0 + (f / hi) ** (2 * order))
    if lo:
        h *= 1.0 / np.sqrt(1.0 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(spec * h, nfft)[:n]


def noise(dur: float) -> np.ndarray:
    return RNG.uniform(-1.0, 1.0, int(dur * SR))


def gate(n: int, dur: float, tail: float, attack: float = 0.003) -> np.ndarray:
    t = np.arange(n) / SR
    g = np.clip(t / attack, 0.0, 1.0) if attack > 0 else np.ones(n)
    off = t >= dur
    if tail > 0:
        g[off] *= np.clip(1.0 - (t[off] - dur) / tail, 0.0, 1.0) ** 2
    else:
        g[off] = 0.0
    return g


def adsr(dur: float, a: float = 0.01, d: float = 0.1, s: float = 0.7,
         r: float = 0.1) -> np.ndarray:
    n = int((dur + r) * SR)
    t = np.arange(n) / SR
    a = max(a, 1e-4)
    env = np.where(t < a, t / a, s + (1.0 - s) * np.exp(-(t - a) / max(d, 1e-4) * 3.0))
    ta = min(dur, max(dur, 0.0))
    lvl = (ta / a) if ta < a else s + (1.0 - s) * math.exp(-(ta - a) / max(d, 1e-4) * 3.0)
    off = t >= dur
    env[off] = lvl * np.clip(1.0 - (t[off] - dur) / max(r, 1e-4), 0.0, 1.0)
    return env


def saw_osc(f: float, t: np.ndarray, maxh: int = 40, fmax: float = 9000.0) -> np.ndarray:
    out = np.zeros_like(t)
    k = 1
    while k <= maxh and k * f < fmax:
        out += np.sin(2 * np.pi * k * f * t) / k
        k += 1
    return out * 0.6


def square_osc(f: float, t: np.ndarray, maxh: int = 15, fmax: float = 9000.0) -> np.ndarray:
    out = np.zeros_like(t)
    k = 1
    while k <= maxh and k * f < fmax:
        out += np.sin(2 * np.pi * k * f * t) / k
        k += 2
    return out * 0.8


def partials(f: float, dur: float, amps, decays, tail: float, inharm: float = 0.0,
             attack: float = 0.003, fmax: float = 9500.0) -> np.ndarray:
    n = int((dur + tail) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, (a, dk) in enumerate(zip(amps, decays), start=1):
        fk = f * k * math.sqrt(1.0 + inharm * k * k)
        if fk >= fmax:
            break
        out += a * np.sin(2 * np.pi * fk * t) * np.exp(-dk * t)
    return out * gate(n, dur, tail, attack)


# --------------------------------------------------------------------------
# Instruments (all return float arrays, roughly unit amplitude)
# --------------------------------------------------------------------------
def epiano(m: float, dur: float) -> np.ndarray:
    f = mtof(m)
    body = partials(f, dur, [1.0, 0.32, 0.10, 0.04], [1.1, 2.4, 4.0, 6.0], 0.35, attack=0.004)
    tine = partials(f * 4, dur, [0.06], [9.0], 0.35, attack=0.002)
    return body + tine[: len(body)]


def piano(m: float, dur: float) -> np.ndarray:
    f = mtof(m)
    amps = [1.0 / k ** 1.25 for k in range(1, 11)]
    decs = [0.55 + 0.85 * k for k in range(1, 11)]
    sig = partials(f, dur, amps, decs, 0.5, inharm=0.0003, attack=0.002, fmax=8000)
    ham = fft_filter(noise(0.02), 300, 2500) * np.exp(-np.arange(int(0.02 * SR)) / SR / 0.004)
    sig[: len(ham)] += 0.08 * ham
    return sig


def pluck(m: float, dur: float, bright: float = 1.0) -> np.ndarray:
    f = mtof(m)
    amps = [(0.85 ** k) / k * (bright if k > 2 else 1.0) for k in range(1, 14)]
    decs = [3.0 + 2.2 * k for k in range(1, 14)]
    return partials(f, dur, amps, decs, 0.12, attack=0.002)


def vibes(m: float, dur: float) -> np.ndarray:
    f = mtof(m)
    return partials(f, dur, [1.0, 0.0, 0.0, 0.18], [1.4, 1, 1, 6.0], 0.5, attack=0.003)


def bell(m: float, dur: float) -> np.ndarray:
    """DX-style FM bell with harmonic 1:3 ratio (keeps chroma clean)."""
    f = mtof(m)
    tail = 1.0
    n = int((dur + tail) * SR)
    t = np.arange(n) / SR
    idx = 2.2 * np.exp(-t * 5.0) + 0.3
    sig = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 1.8)
    sig += 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3.5)
    return sig * gate(n, dur, tail, 0.002)


def lead(m: float, dur: float, maxh: int = 9, vib: float = 0.004) -> np.ndarray:
    f = mtof(m)
    env = adsr(dur, a=0.012, d=0.15, s=0.7, r=0.12)
    t = np.arange(len(env)) / SR
    vdepth = vib * np.clip((t - 0.15) / 0.2, 0, 1)
    ph_mod = 1.0 + vdepth * np.sin(2 * np.pi * 5.5 * t)
    tt = np.cumsum(ph_mod) / SR
    return square_osc(f, tt, maxh=maxh) * env


def saw_note(m: float, dur: float, maxh: int = 30, a=0.004, d=0.12, s=0.0, r=0.05,
             detune_cents=(0.0,)) -> np.ndarray:
    env = adsr(dur, a=a, d=d, s=s, r=r)
    t = np.arange(len(env)) / SR
    out = np.zeros_like(t)
    for c in detune_cents:
        out += saw_osc(mtof(m) * 2 ** (c / 1200.0), t + RNG.uniform(0, 0.01), maxh=maxh)
    return out / len(detune_cents) * env


def pad_note(m: float, dur: float, maxh: int = 8, a: float = 0.6, r: float = 0.8,
             sine: bool = False) -> np.ndarray:
    env = adsr(dur, a=a, d=0.6, s=0.85, r=r)
    t = np.arange(len(env)) / SR
    out = np.zeros_like(t)
    for c in (-9.0, 0.0, 8.0):
        f = mtof(m) * 2 ** (c / 1200.0)
        ph = RNG.uniform(0, 1)
        if sine:
            out += np.sin(2 * np.pi * f * (t + ph)) + 0.15 * np.sin(4 * np.pi * f * (t + ph))
        else:
            out += saw_osc(f, t + ph, maxh=maxh)
    return out / 3.0 * env


def bass_note(m: float, dur: float, kind: str = "sine") -> np.ndarray:
    env = adsr(dur, a=0.004, d=0.25, s=0.55, r=0.06)
    t = np.arange(len(env)) / SR
    f = mtof(m)
    if kind == "sine":
        sig = np.sin(2 * np.pi * f * t) + 0.30 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    elif kind == "saw":
        sig = saw_osc(f, t, maxh=14)
    else:  # "pluck" upright-ish
        sig = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)
        env = env * np.exp(-t * 1.5)
    return sig * env


# ---- drums --------------------------------------------------------------
def kick(f0: float = 150.0, f1: float = 48.0, decay: float = 0.28, click: float = 1.0) -> np.ndarray:
    n = int(decay * 2.5 * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t / decay)
    clk = fft_filter(noise(n / SR), 800, 5000) * np.exp(-t / 0.003)
    sig += 0.35 * click * clk
    sig *= np.clip(t / 0.001, 0, 1)
    return sig


def snare(decay: float = 0.12) -> np.ndarray:
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    nz = fft_filter(noise(n / SR), 1200, 7500) * np.exp(-t / decay)
    return 0.5 * tone + 0.9 * nz


def clap() -> np.ndarray:
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for ti in (0.0, 0.010, 0.021):
        m = t >= ti
        env[m] += np.exp(-(t[m] - ti) / 0.005)
    m = t >= 0.03
    env[m] += 0.9 * np.exp(-(t[m] - 0.03) / 0.10)
    return fft_filter(noise(n / SR), 900, 6000) * env * 1.4


def hat(open_: bool = False) -> np.ndarray:
    dec = 0.14 if open_ else 0.028
    n = int(dec * 6 * SR)
    t = np.arange(n) / SR
    return fft_filter(noise(n / SR), 6500, None, order=3) * np.exp(-t / dec) * np.clip(t / 0.0008, 0, 1)


def brush() -> np.ndarray:
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    env = np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.10)
    return fft_filter(noise(n / SR), 1800, 6000) * env


def crash() -> np.ndarray:
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    return fft_filter(noise(n / SR), 3500, 10000) * np.exp(-t / 0.9) * np.clip(t / 0.002, 0, 1)


# --------------------------------------------------------------------------
# Song container / mixer
# --------------------------------------------------------------------------
def make_ir(length: float = 1.8, tau: float = 0.33, hi: float = 4500.0) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    ir = rng.standard_normal(n) * np.exp(-t / tau)
    ir[: int(0.018 * SR)] = 0.0
    ir = fft_filter(ir, 120, hi)
    return ir / np.sqrt(np.sum(ir ** 2))


class Song:
    def __init__(self, bpm: float, tonic_pc: int, scale, beats_per_bar: int = 4):
        self.bpm = bpm
        self.spb = 60.0 / bpm
        self.tonic = tonic_pc
        self.scale = scale
        self.bpb = beats_per_bar
        self.buses: dict[str, np.ndarray] = {}
        self.cfg: dict[str, dict] = {}

    # -- timing
    @property
    def bar_sec(self) -> float:
        return self.bpb * self.spb

    def n_bars(self) -> int:
        return int(math.ceil(DUR / self.bar_sec))

    def bt(self, bar: int, beat: float) -> float:
        return (bar * self.bpb + beat) * self.spb

    # -- mixing
    def bus(self, name: str, lo=None, hi=None, send: float = 0.0, order: int = 2):
        self.buses.setdefault(name, np.zeros(N + SR * 3))
        self.cfg[name] = dict(lo=lo, hi=hi, send=send, order=order)

    def add(self, name: str, t_sec: float, sig: np.ndarray, gain: float = 1.0):
        i = int(round(t_sec * SR))
        if i >= N or i < 0:
            return
        buf = self.buses[name]
        seg = sig[: len(buf) - i]
        buf[i: i + len(seg)] += gain * seg

    # -- theory
    def chord_notes(self, chord, low: int) -> list[int]:
        root_pc = (self.tonic + chord[0]) % 12
        root = low + ((root_pc - low) % 12)
        return [root + iv for iv in QUAL[chord[1]]]

    def root(self, chord, low: int) -> int:
        return self.chord_notes(chord, low)[0]

    def mel(self, chord, rel_deg: int, center: int) -> int:
        root_pc = (self.tonic + chord[0]) % 12
        rdeg = self.scale.index(chord[0] % 12)
        octv, r = divmod(rel_deg, 7)
        root_m = center + ((root_pc - center) % 12)
        if root_m - center > 6:
            root_m -= 12
        if r in (0, 2, 4):
            iv = QUAL[chord[1]][r // 2]
        else:
            o2, idx = divmod(rdeg + r, 7)
            iv = self.scale[idx] + 12 * o2 - self.scale[rdeg]
        return root_m + iv + 12 * octv

    # -- render
    def render(self, master_hi=None, drive: float = 0.0, ir=None, wet: float = 1.0,
               time_gain=None) -> np.ndarray:
        total = np.zeros(N + SR * 3)
        send = np.zeros_like(total)
        for name, buf in self.buses.items():
            c = self.cfg[name]
            x = fft_filter(buf, c["lo"], c["hi"], c["order"]) if (c["lo"] or c["hi"]) else buf
            total += x
            if c["send"]:
                send += x * c["send"]
        if np.any(send):
            ir = make_ir() if ir is None else ir
            nfft = 1 << int(math.ceil(math.log2(len(send) + len(ir))))
            rev = np.fft.irfft(np.fft.rfft(send, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(send)]
            total += wet * rev
        y = total[:N]
        y = fft_filter(y, 28, master_hi, order=1 if master_hi else 2)
        if time_gain is not None:
            y = y * time_gain(np.arange(N) / SR)
        y = y / (np.max(np.abs(y)) + 1e-12)
        if drive > 0:
            y = np.tanh(drive * y) / math.tanh(drive)
        # fades
        fi = int(FADE_IN * SR)
        fo = int(FADE_OUT * SR)
        y[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
        y[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        y = y / (np.max(np.abs(y)) + 1e-12) * 10 ** (PEAK_DBFS / 20.0)
        return y


# --------------------------------------------------------------------------
# Tracks
# --------------------------------------------------------------------------
def play_motif(s: Song, bus: str, bar: int, chord, motif, center: int, inst, gain: float,
               transpose: int = 0):
    for beat, dur, deg, *vel in motif:
        v = vel[0] if vel else 1.0
        m = s.mel(chord, deg, center) + transpose
        s.add(bus, s.bt(bar, beat), inst(m, dur * s.spb), gain * v)


def day1_autumn_waltz() -> np.ndarray:
    s = Song(84, 5, MAJOR, beats_per_bar=3)  # F major, 3/4
    for b, kw in (("bass", dict(hi=900, send=0.15)), ("keys", dict(hi=3000, send=0.3)),
                  ("brush", dict(hi=6000, send=0.2)), ("mel", dict(hi=3500, send=0.35))):
        s.bus(b, **kw)
    prog = [(0, "maj7"), (9, "m7"), (2, "m7"), (7, "7"), (0, "maj7"), (5, "maj7"), (7, "7"), (0, "maj7")]
    A = [(0, 2, 4, 1.0), (2, 1, 2, 0.8)]
    B = [(0, 1, 2, 1.0), (1, 1, 1, 0.75), (2, 1, 0, 0.85)]
    C = [(0, 1, 4, 1.0), (1, 1, 5, 0.75), (2, 1, 7, 0.9)]
    D = [(0, 3, 2, 1.0)]
    mel_pat = [A, B, A, D, C, B, A, D]
    for bar in range(s.n_bars()):
        ch = prog[bar % len(prog)]
        r = s.root(ch, 36)
        s.add("bass", s.bt(bar, 0), bass_note(r, 1.6 * s.spb, "pluck"), 0.55)
        s.add("bass", s.bt(bar, 2), bass_note(r + 7, 0.8 * s.spb, "pluck"), 0.25)
        notes = s.chord_notes(ch, 53)
        for beat, g, d in ((0, 0.16, 1.0), (1, 0.12, 0.8), (2, 0.12, 0.8)):
            for m in notes:
                s.add("keys", s.bt(bar, beat), epiano(m, d * s.spb), g)
        for beat in range(3):
            s.add("brush", s.bt(bar, beat), brush(), 0.22 if beat == 0 else 0.13)
        if bar >= 1:
            play_motif(s, "mel", bar, ch, mel_pat[(bar - 1) % 8], 72, vibes, 0.30)
    return s.render(master_hi=2800)


def day2_night_deadline() -> np.ndarray:
    s = Song(128, 9, MINOR)  # A minor
    s.bus("kick")
    s.bus("perc", lo=300, send=0.1)
    s.bus("bass", hi=900)
    s.bus("arp", hi=7000, send=0.25)
    s.bus("pad", hi=1300, send=0.4)
    s.bus("lead", hi=5000, send=0.3)
    prog = [(0, "min"), (8, "maj"), (5, "min"), (7, "maj")]  # Am F Dm E
    arp_pat = [0, 1, 2, 3, 4, 3, 2, 1]
    LA = [(0, 2, 4), (2, 2, 2)]
    LB = [(0, 3, 0), (3, 1, 1)]
    for bar in range(s.n_bars()):
        ch = prog[bar % 4]
        r = s.root(ch, 36)
        for beat in range(4):
            s.add("kick", s.bt(bar, beat), kick(160, 45, 0.25), 1.0)
            s.add("perc", s.bt(bar, beat + 0.5), hat(True), 0.28)
            s.add("bass", s.bt(bar, beat + 0.5), saw_note(r, 0.4 * s.spb, maxh=14, d=0.1, s=0.3), 0.32)
            for q in (0.25, 0.75):
                s.add("perc", s.bt(bar, beat + q), hat(False), 0.10)
            if beat in (1, 3):
                s.add("perc", s.bt(bar, beat), clap(), 0.35)
        tones = s.chord_notes(ch, 57)
        tones = tones[:3] + [tones[0] + 12, tones[1] + 12]
        for i in range(16):
            m = tones[arp_pat[i % 8]]
            s.add("arp", s.bt(bar, i * 0.25), saw_note(m, 0.2 * s.spb, maxh=25, d=0.09, s=0.1), 0.13)
        for m in s.chord_notes(ch, 45):
            s.add("pad", s.bt(bar, 0), pad_note(m, s.bar_sec, maxh=10, a=0.3, r=0.4), 0.10)
        if bar >= 8:
            play_motif(s, "lead", bar, ch, LA if bar % 2 == 0 else LB, 76,
                       lambda m, d: lead(m, d, maxh=11), 0.12)
    return s.render(drive=2.2)


def day3_summer_sea() -> np.ndarray:
    s = Song(120, 2, MAJOR)  # D major
    s.bus("kick")
    s.bus("perc", lo=250, send=0.12)
    s.bus("bass", hi=1300)
    s.bus("pluck", hi=7000, send=0.2)
    s.bus("lead", hi=6000, send=0.25)
    prog = [(0, "maj"), (5, "maj"), (0, "maj"), (7, "maj")]  # D G D A
    bass_pat = [(0, 0), (0.5, 12), (1.5, 0), (2, 7), (2.5, 12), (3.5, 7)]
    arp = [0, 1, 2, 1, 3, 2, 1, 2]
    A = [(0, 1, 4), (1, 0.5, 5), (1.5, 1, 4), (2.5, 0.5, 2), (3, 1, 0)]
    B = [(0, 1.5, 2), (1.5, 0.5, 1), (2, 2, 0)]
    C = [(0, 0.5, 7), (0.5, 0.5, 6), (1, 1, 4), (2, 1, 5), (3, 1, 4)]
    D = [(0, 4, 2)]
    pat = [A, B, C, D]
    for bar in range(s.n_bars()):
        ch = prog[bar % 4]
        r = s.root(ch, 38)
        for beat in range(4):
            s.add("kick", s.bt(bar, beat), kick(140, 50, 0.26), 0.9)
            if beat in (1, 3):
                s.add("perc", s.bt(bar, beat), clap(), 0.40)
                s.add("perc", s.bt(bar, beat), snare(0.1), 0.25)
            s.add("perc", s.bt(bar, beat), hat(False), 0.12)
            s.add("perc", s.bt(bar, beat + 0.5), hat(beat == 3), 0.16)
        for pos, iv in bass_pat:
            s.add("bass", s.bt(bar, pos), bass_note(r + iv, 0.42 * s.spb, "saw"), 0.30)
        tones = s.chord_notes(ch, 62)
        tones = tones + [tones[0] + 12]
        for i in range(8):
            s.add("pluck", s.bt(bar, i * 0.5), pluck(tones[arp[i]], 0.45 * s.spb, 1.2), 0.17)
        if bar >= 2:
            play_motif(s, "lead", bar, ch, pat[bar % 4], 74, lambda m, d: lead(m, d, maxh=9), 0.16)
    return s.render(drive=1.8)


def day4_rain_piano() -> np.ndarray:
    s = Song(62, 4, MINOR)  # E minor
    s.bus("lh", hi=3000, send=0.45)
    s.bus("rh", hi=3500, send=0.5)
    s.bus("pad", hi=1500, send=0.5)
    prog = [(0, "min"), (8, "maj"), (5, "min"), (7, "7"), (0, "min"), (5, "min"), (7, "7"), (0, "min")]
    A = [(0, 2, 4), (2, 2, 2)]
    B = [(0, 1, 2), (1, 1, 1), (2, 2, 0)]
    C = [(0, 3, 4), (3, 1, 5)]
    D = [(0, 4, 0)]
    pat = [A, B, C, D, A, C, B, D]
    for bar in range(s.n_bars()):
        ch = prog[bar % 8]
        s.add("lh", s.bt(bar, 0), piano(s.root(ch, 40), 3.0 * s.spb), 0.40)
        nt = s.chord_notes(ch, 52)[:3]
        for beat, m in ((1, nt[1]), (2, nt[2]), (3, nt[0] + 12)):
            s.add("lh", s.bt(bar, beat), piano(m, 0.95 * s.spb), 0.17)
        play_motif(s, "rh", bar, ch, pat[bar % 8], 76, piano, 0.30)
        for m in s.chord_notes(ch, 52)[:3]:
            s.add("pad", s.bt(bar, 0), pad_note(m, s.bar_sec, a=1.0, r=1.0, sine=True), 0.025)
    return s.render(master_hi=3200, ir=make_ir(2.2, 0.45, 3500))


def day5_first_snow_retro() -> np.ndarray:
    s = Song(92, 0, MAJOR)  # C major
    s.bus("kick", hi=4000)
    s.bus("snare", lo=200, send=0.6)
    s.bus("hat", lo=5000)
    s.bus("bass", hi=700)
    s.bus("pad", hi=1800, send=0.4)
    s.bus("bell", hi=6000, send=0.45)
    prog = [(0, "maj"), (9, "min"), (5, "maj"), (7, "maj")]  # C Am F G
    A = [(0, 1, 2), (1, 1, 4), (2, 1, 7), (3, 1, 4)]
    B = [(0, 2, 2), (2, 2, 0)]
    C = [(0, 1.5, 4), (1.5, 0.5, 5), (2, 2, 4)]
    D = [(0, 4, 0)]
    pat = [A, B, C, D]
    for bar in range(s.n_bars()):
        ch = prog[bar % 4]
        r = s.root(ch, 36)
        for beat in range(4):
            if beat in (0, 2):
                s.add("kick", s.bt(bar, beat), kick(120, 48, 0.32, click=0.5), 0.75)
            else:
                s.add("snare", s.bt(bar, beat), snare(0.14), 0.32)
            for q in (0.0, 0.5):
                s.add("hat", s.bt(bar, beat + q), hat(False), 0.07 if q else 0.09)
        for i in range(8):
            s.add("bass", s.bt(bar, i * 0.5), saw_note(r, 0.4 * s.spb, maxh=10, d=0.15, s=0.35), 0.20)
        for m in s.chord_notes(ch, 55):
            s.add("pad", s.bt(bar, 0), pad_note(m, s.bar_sec, maxh=10, a=0.25, r=0.6), 0.075)
        if bar >= 1:
            play_motif(s, "bell", bar, ch, pat[(bar - 1) % 4], 74, bell, 0.22)
    return s.render(master_hi=5000)


def day6_mountain_dawn() -> np.ndarray:
    s = Song(100, 7, MAJOR)  # G major
    s.bus("kick", hi=5000)
    s.bus("perc", lo=300, send=0.3)
    s.bus("bass", hi=800)
    s.bus("gtr", hi=4500, send=0.45)
    s.bus("pad", hi=1600, send=0.5)
    s.bus("trem", hi=3500, send=0.45)
    prog = [(0, "maj"), (7, "maj"), (5, "maj"), (0, "maj")]  # G D C G (keeps tonic strong)
    MA = [(0, 2, 4), (2, 2, 2)]
    MB = [(0, 2, 2), (2, 1, 1), (3, 1, 0)]
    for bar in range(s.n_bars()):
        ch = prog[bar % 4]
        t0 = s.bt(bar, 0)
        lvl = 0.35 + 0.65 * min(1.0, t0 / 24.0)
        tones = s.chord_notes(ch, 55)
        arp = [tones[0], tones[1], tones[2], tones[0] + 12]
        for beat in range(4):
            s.add("gtr", s.bt(bar, beat), pluck(arp[beat], 0.9 * s.spb, 0.8), 0.22)
            s.add("gtr", s.bt(bar, beat + 0.75), pluck(arp[beat], 0.6 * s.spb, 0.6), 0.06)
        for m in s.chord_notes(ch, 50):
            s.add("pad", t0, pad_note(m, s.bar_sec, maxh=6, a=0.8, r=0.9), 0.06 * lvl)
        if t0 >= 7.0:
            s.add("bass", t0, bass_note(s.root(ch, 36), 3.8 * s.spb, "saw"), 0.30 * lvl)
            for beat in range(4):
                s.add("kick", s.bt(bar, beat), kick(110, 45, 0.3, click=0.4), 0.45 if t0 < 14 else 0.95)
        if t0 >= 14.0:
            for beat in range(4):
                if beat in (1, 3):
                    s.add("perc", s.bt(bar, beat), snare(0.16), 0.40)
                for q in (0.0, 0.5):
                    s.add("perc", s.bt(bar, beat + q), hat(t0 >= 21.0 and q == 0.5), 0.10)
            motif = MA if bar % 2 == 0 else MB
            for beat, dur, deg in motif:
                m = s.mel(ch, deg, 71)
                for k in range(int(dur * 2)):
                    sig = saw_note(m, 0.45 * s.spb, maxh=18, a=0.006, d=0.12, s=0.4, r=0.05)
                    s.add("trem", s.bt(bar, beat + k * 0.5), sig, 0.12)
                    if t0 >= 21.0:
                        s.add("trem", s.bt(bar, beat + k * 0.5),
                              saw_note(m + 12, 0.45 * s.spb, maxh=10, a=0.006, d=0.12, s=0.4, r=0.05), 0.07)
        if t0 >= 21.0 and abs(t0 - s.bt(9, 0)) < 1e-6:
            s.add("perc", t0, crash(), 0.45)
    return s.render(drive=1.2, time_gain=lambda t: 0.28 + 0.72 * np.clip(t / 26.0, 0, 1) ** 1.4)


def day7_birthday_dance() -> np.ndarray:
    s = Song(124, 10, MAJOR)  # Bb major
    s.bus("kick")
    s.bus("perc", lo=300, send=0.12)
    s.bus("bass", hi=1500)
    s.bus("stab", lo=150, hi=8000, send=0.25)
    s.bus("lead", hi=7000, send=0.25)
    prog = [(0, "maj"), (5, "maj"), (7, "maj"), (0, "maj")]  # Bb Eb F Bb
    A = [(0, 0.5, 0), (0.5, 0.5, 0), (1, 1, 2), (2, 1, 4), (3, 1, 7)]
    B = [(0, 1, 4), (1, 0.5, 5), (1.5, 0.5, 4), (2, 2, 2)]
    C = [(0, 0.5, 7), (0.5, 0.5, 7), (1, 1, 6), (2, 1, 4), (3, 1, 2)]
    D = [(0, 1, 4), (1, 1, 2), (2, 2, 0)]
    pat = [A, B, C, D]
    for bar in range(s.n_bars()):
        ch = prog[bar % 4]
        r = s.root(ch, 34)
        for beat in range(4):
            s.add("kick", s.bt(bar, beat), kick(170, 50, 0.24, click=1.2), 1.0)
            if beat in (1, 3):
                s.add("perc", s.bt(bar, beat), clap(), 0.50)
            s.add("perc", s.bt(bar, beat + 0.5), hat(True), 0.22)
            for q in (0.25, 0.75):
                s.add("perc", s.bt(bar, beat + q), hat(False), 0.09)
            for q, iv in ((0.0, 0), (0.5, 12)):
                s.add("bass", s.bt(bar, beat + q), bass_note(r + iv, 0.4 * s.spb, "saw"), 0.30)
            for m in s.chord_notes(ch, 58):
                s.add("stab", s.bt(bar, beat + 0.5),
                      saw_note(m, 0.3 * s.spb, maxh=28, d=0.12, s=0.2, detune_cents=(-12, 0, 11)), 0.075)
        if bar >= 2:
            play_motif(s, "lead", bar, ch, pat[bar % 4], 77, lambda m, d: lead(m, d, maxh=11), 0.16)
        if bar in (0, 8):
            s.add("perc", s.bt(bar, 0), crash(), 0.35)
    return s.render(drive=2.6)


TRACKS = [
    ("day1_autumn_waltz.wav", day1_autumn_waltz),
    ("day2_night_deadline.wav", day2_night_deadline),
    ("day3_summer_sea.wav", day3_summer_sea),
    ("day4_rain_piano.wav", day4_rain_piano),
    ("day5_first_snow_retro.wav", day5_first_snow_retro),
    ("day6_mountain_dawn.wav", day6_mountain_dawn),
    ("day7_birthday_dance.wav", day7_birthday_dance),
]


def write_wav(path: str, y: np.ndarray) -> None:
    pcm = np.clip(np.round(y * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def verify(path: str) -> None:
    with wave.open(path, "rb") as w:
        n = w.getnframes()
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768.0
        ch, sw = w.getnchannels(), w.getsampwidth()
    peak = np.max(np.abs(x))
    rms = np.sqrt(np.mean(x ** 2))
    print(f"  {os.path.basename(path):28s} {n / sr:6.2f}s  {sr}Hz ch={ch} {sw * 8}bit  "
          f"peak={20 * math.log10(peak):6.2f} dBFS  rms={20 * math.log10(rms):6.2f} dBFS  "
          f"size={os.path.getsize(path) / 1e6:.2f} MB")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, fn in TRACKS:
        y = fn()
        write_wav(os.path.join(OUT_DIR, name), y)
        print("wrote", name)
    print("verification:")
    for name, _ in TRACKS:
        verify(os.path.join(OUT_DIR, name))


if __name__ == "__main__":
    main()
