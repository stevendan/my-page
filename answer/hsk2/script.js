const content = document.getElementById('content');
const quickLessons = document.getElementById('quickLessons');
const backToTopBtn = document.getElementById('backToTop');

let rawText = '';
let lessonMap = new Map();
let lessonNumbers = [];
let currentLesson = 1;

const audio = new Audio();
let playingLesson = null;
let playingPart = null;
let playerEl = null;

const EXAM_AUDIO_SRC = 'mp3/16 HSK（二级）模拟试卷.mp3';

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function highlightText(line, keyword) {
    if (!keyword) return escapeHtml(line);
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'gi');
    let result = '';
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        result += escapeHtml(line.slice(lastIndex, start));
        result += `<mark>${escapeHtml(line.slice(start, end))}</mark>`;
        lastIndex = end;
    }
    result += escapeHtml(line.slice(lastIndex));
    return result;
}

// ── Audio player (footer, sticky bottom) ─────────────────────

function generateWaveformBars(seed, barCount) {
    let s = (seed * 2654435761) >>> 0;
    const bars = [];
    for (let i = 0; i < barCount; i++) {
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
        s ^= (s >>> 16);
        bars.push(8 + (Math.abs(s) % 26));
    }
    return bars;
}

function buildWaveformURI(bars, w, h, color) {
    const barW = 3, gap = 2, step = barW + gap;
    const rects = bars.map((bh, i) => {
        const x = i * step;
        const y = ((h - bh) / 2).toFixed(1);
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="1.5"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" fill="${color}">${rects}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function applyWaveform(seed) {
    const fp     = document.getElementById('footer-player');
    const bgEl   = fp.querySelector('.fp-bar-bg');
    const fillEl = fp.querySelector('.fp-bar-fill');
    const wrapEl = fp.querySelector('.fp-bar-wrap');
    const w      = wrapEl.offsetWidth  || 300;
    const h      = wrapEl.offsetHeight || 38;
    const bars   = generateWaveformBars(seed, Math.floor(w / 5));
    const bsz    = `${w}px ${h}px`;
    bgEl.style.backgroundImage   = buildWaveformURI(bars, w, h, 'rgba(255,255,255,0.22)');
    bgEl.style.backgroundSize    = bsz;
    fillEl.style.backgroundImage = buildWaveformURI(bars, w, h, 'rgba(234,140,82,0.88)');
    fillEl.style.backgroundSize  = bsz;
}

function removePlayer() {
    if (playerEl) {
        playerEl.setAttribute('hidden', '');
        document.body.classList.remove('has-player');
        playerEl = null;
    }
}

function attachPlayer(lessonNum, part) {
    const fp = document.getElementById('footer-player');
    if (lessonNum === 16) {
        fp.querySelector('.fp-num').textContent  = '模';
        fp.querySelector('.fp-track').textContent = 'Mô phỏng';
    } else {
        fp.querySelector('.fp-num').textContent  = lessonNum;
        const partLabel = part === 1 ? 'Nghe' : part === 2 ? 'Ngữ âm' : `Phần ${part}`;
        fp.querySelector('.fp-track').textContent = `Bài ${lessonNum} · ${partLabel}`;
    }
    fp.removeAttribute('hidden');
    document.body.classList.add('has-player');
    playerEl = fp;
    requestAnimationFrame(() => applyWaveform(lessonNum * 3 + (part || 0)));
    updatePlayerUI();
}

function updatePlayerUI() {
    if (!playerEl) return;
    const playBtn = playerEl.querySelector('.fp-play');
    const seekEl  = playerEl.querySelector('.fp-seek');
    const timeEl  = playerEl.querySelector('.fp-time');
    const durEl   = playerEl.querySelector('.fp-duration');
    const fillEl  = playerEl.querySelector('.fp-bar-fill');

    playBtn.textContent = audio.paused ? '▶' : '⏸';
    timeEl.textContent  = formatTime(audio.currentTime);

    if (audio.duration && !isNaN(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        seekEl.value = pct;
        if (fillEl) fillEl.style.width = `${pct}%`;
        durEl.textContent = formatTime(audio.duration);
    }
}

function syncAudioBtn(lessonNum, part, playing) {
    if (lessonNum === null) return;
    const btn = document.querySelector(`.audio-btn[data-lesson="${lessonNum}"][data-part="${part}"]`);
    if (btn) {
        btn.textContent = playing ? '⏸' : '▶';
        btn.classList.toggle('is-playing', playing);
    }
    const heading = document.getElementById(`lesson-${lessonNum}`);
    if (heading) heading.classList.toggle('audio-playing', playing);
}

// ── Render ────────────────────────────────────────────────────

function renderContent(keyword = '') {
    const lines = rawText.split(/\r?\n/);
    const lessonLineRegex   = /^第\s*(\d{1,2})课([^\n]*)$/;
    const majorSectionRegex = /^(?:[一二三四五六七八九十]+、\s*(?:听力|阅读|书写|复习|语音)|听力|阅读|书写|复习|语音)$/;
    const subSectionRegex   = /^(?:第\s*[一二三四五六七八九十]+\s*部分|第\s*\d+\s*题)(?:.*)?$/;
    const examTitleRegex    = /^HSK\s*二级模拟试卷$/;

    let html = '';
    let lessonOpen = false;
    let majorOpen  = false;
    let subOpen    = false;
    let introOpen  = false;
    let currentLessonNum = null;

    function openIntro()   { if (!introOpen)  { html += '<div class="intro-block">'; introOpen = true; } }
    function closeIntro()  { if (introOpen)   { html += '</div>'; introOpen = false; } }
    function closeSub()    { if (subOpen)     { html += '</div>'; subOpen = false; } }
    function closeMajor()  { closeSub(); if (majorOpen) { html += '</div>'; majorOpen = false; } }
    function closeLesson() { closeMajor(); if (lessonOpen) { html += '</div>'; lessonOpen = false; } }

    function lineClassFor(text) {
        if (!text.trim()) return 'line empty';
        if (/^参考答案[:：]?$/.test(text.trim())) return 'line answer-line';
        return 'line';
    }

    lines.forEach((line) => {
        const lessonMatchLocal = line.match(lessonLineRegex);
        const trimmed = line.trim();

        // Regular lesson heading (第1课 … 第15课)
        if (lessonMatchLocal) {
            closeIntro(); closeLesson();
            const n = Number(lessonMatchLocal[1]);
            currentLessonNum = n;
            lessonOpen = true;
            html += `<div class="lesson-block">` +
                    `<div id="lesson-${n}" class="lesson-heading${playingLesson === n ? ' audio-playing' : ''}">` +
                    `<span>${highlightText(line, keyword)}</span>` +
                    `</div>`;
            return;
        }

        // Exam heading (HSK 二级模拟试卷)
        if (examTitleRegex.test(trimmed)) {
            closeIntro(); closeLesson();
            const n = 16;
            currentLessonNum = n;
            lessonOpen = true;
            const examActive = playingLesson === n && !audio.paused;
            html += `<div class="lesson-block">` +
                    `<div id="lesson-${n}" class="lesson-heading${playingLesson === n ? ' audio-playing' : ''}">` +
                    `<span>${highlightText(line, keyword)}</span>` +
                    `<button class="audio-btn${examActive ? ' is-playing' : ''}" data-lesson="${n}" data-part="0" data-src="${EXAM_AUDIO_SRC}" type="button" title="Phát audio mô phỏng">${examActive ? '⏸' : '▶'}</button>` +
                    `</div>`;
            return;
        }

        if (!lessonOpen) {
            openIntro();
            html += `<div class="${lineClassFor(line)}">${highlightText(line, keyword)}</div>`;
            return;
        }

        if (majorSectionRegex.test(trimmed)) {
            closeSub();
            if (majorOpen) html += '</div>';
            majorOpen = true;

            let sectionBtn = '';
            if (currentLessonNum !== null && currentLessonNum !== 16) {
                const padded = String(currentLessonNum).padStart(2, '0');
                if (/一、.*听力|^听力$/.test(trimmed)) {
                    const src = `mp3/${padded}-1.mp3`;
                    const isActive = playingLesson === currentLessonNum && playingPart === 1 && !audio.paused;
                    sectionBtn = `<button class="audio-btn${isActive ? ' is-playing' : ''}" data-lesson="${currentLessonNum}" data-part="1" data-src="${src}" type="button" title="Phát audio phần nghe">${isActive ? '⏸' : '▶'}</button>`;
                } else if (/三、.*语音|^语音$/.test(trimmed)) {
                    const src = `mp3/${padded}-2.mp3`;
                    const isActive = playingLesson === currentLessonNum && playingPart === 2 && !audio.paused;
                    sectionBtn = `<button class="audio-btn${isActive ? ' is-playing' : ''}" data-lesson="${currentLessonNum}" data-part="2" data-src="${src}" type="button" title="Phát audio phần ngữ âm">${isActive ? '⏸' : '▶'}</button>`;
                }
            }
            html += `<div class="major-section"><div class="major-heading">${highlightText(line, keyword)}${sectionBtn}</div>`;
            return;
        }

        if (subSectionRegex.test(trimmed)) {
            closeSub();
            if (!majorOpen) { majorOpen = true; html += '<div class="major-section">'; }
            subOpen = true;
            html += `<div class="sub-section"><div class="sub-heading">${highlightText(line, keyword)}</div>`;
            return;
        }

        html += `<div class="${lineClassFor(line)}">${highlightText(line, keyword)}</div>`;
    });

    closeIntro(); closeLesson();
    content.innerHTML = html;

    if (playingLesson !== null) {
        updatePlayerUI();
        syncAudioBtn(playingLesson, playingPart, !audio.paused);
    }
}

function renderLessonOptions() {
    quickLessons.innerHTML = lessonNumbers
        .map((n) => `<button type="button" class="quick-lesson" data-lesson="${n}">${n}</button>`)
        .join('');
}

function setCurrentLesson(lessonNumber) {
    if (!lessonNumbers.includes(lessonNumber)) return;
    currentLesson = lessonNumber;
    document.querySelectorAll('.quick-lesson').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.lesson) === lessonNumber);
    });
}

function goToLesson(lessonNumber, smooth = true) {
    setCurrentLesson(lessonNumber);
    const anchor = document.getElementById(`lesson-${lessonNumber}`);
    if (anchor) anchor.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

function init(text) {
    rawText = text.replace(/^﻿/, '');
    const lessonRegex = /第\s*(\d{1,2})课[^\n]*/g;
    let lessonMatch;
    while ((lessonMatch = lessonRegex.exec(rawText)) !== null) {
        const n = Number(lessonMatch[1]);
        if (n >= 1 && n <= 15 && !lessonMap.has(n)) {
            lessonMap.set(n, lessonMatch[0].trim());
        }
    }
    lessonNumbers = Array.from(lessonMap.keys()).sort((a, b) => a - b);
    currentLesson = lessonNumbers[0] || 1;
    renderContent('');
    renderLessonOptions();
    setCurrentLesson(currentLesson);
}

fetch('content.html')
    .then((r) => r.text())
    .then((text) => init(text));

// ── Event listeners ───────────────────────────────────────────

quickLessons.addEventListener('click', function (event) {
    const target = event.target.closest('.quick-lesson');
    if (!target) return;
    goToLesson(Number(target.dataset.lesson));
});

window.addEventListener('scroll', function () {
    backToTopBtn.classList.toggle('show', window.scrollY > 300);
});

backToTopBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Click on audio button inside lesson heading
content.addEventListener('click', function (event) {
    const btn = event.target.closest('.audio-btn');
    if (!btn) return;

    const lessonNum = Number(btn.dataset.lesson);
    const part = Number(btn.dataset.part);

    if (playingLesson === lessonNum && playingPart === part) {
        if (audio.paused) audio.play(); else audio.pause();
    } else {
        if (playingLesson !== null) {
            syncAudioBtn(playingLesson, playingPart, false);
        }
        audio.src = encodeURI(btn.dataset.src);
        audio.currentTime = 0;
        audio.play();
        playingLesson = lessonNum;
        playingPart   = part;
        attachPlayer(lessonNum, part);
    }
});

// ── Audio events ──────────────────────────────────────────────

audio.addEventListener('play', function () {
    syncAudioBtn(playingLesson, playingPart, true);
    updatePlayerUI();
});

audio.addEventListener('pause', function () {
    syncAudioBtn(playingLesson, playingPart, false);
    updatePlayerUI();
});

audio.addEventListener('timeupdate', updatePlayerUI);
audio.addEventListener('loadedmetadata', updatePlayerUI);

audio.addEventListener('ended', function () {
    syncAudioBtn(playingLesson, playingPart, false);
    playingLesson = null;
    playingPart   = null;
    removePlayer();
});

// ── Footer player controls ────────────────────────────────────
(function () {
    const fp = document.getElementById('footer-player');

    fp.querySelector('.fp-play').addEventListener('click', function () {
        if (audio.paused) audio.play(); else audio.pause();
    });

    fp.querySelector('.fp-seek').addEventListener('input', function () {
        if (audio.duration) audio.currentTime = (this.value / 100) * audio.duration;
    });

    fp.querySelector('.fp-close').addEventListener('click', function () {
        audio.pause();
        audio.currentTime = 0;
        syncAudioBtn(playingLesson, playingPart, false);
        playingLesson = null;
        playingPart   = null;
        removePlayer();
    });
}());
