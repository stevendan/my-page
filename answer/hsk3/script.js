const searchBox = document.getElementById('searchBox');
const content = document.getElementById('content');
const lessonSelect = document.getElementById('lessonSelect');
const quickLessons = document.getElementById('quickLessons');
const prevLessonBtn = document.getElementById('prevLesson');
const nextLessonBtn = document.getElementById('nextLesson');
const goLessonBtn = document.getElementById('goLesson');
const backToTopBtn = document.getElementById('backToTop');

const rawText = content.textContent.replace(/^﻿/, '');
const lessonMap = new Map();
const lessonRegex = /第\s*(\d{1,2})课[^\n]*/g;
let lessonMatch;

while ((lessonMatch = lessonRegex.exec(rawText)) !== null) {
    const lessonNumber = Number(lessonMatch[1]);
    if (lessonNumber >= 1 && lessonNumber <= 20 && !lessonMap.has(lessonNumber)) {
        lessonMap.set(lessonNumber, lessonMatch[0].trim());
    }
}

const lessonNumbers = Array.from(lessonMap.keys()).sort((a, b) => a - b);
let currentLesson = lessonNumbers[0] || 1;

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function highlightText(line, keyword) {
    if (!keyword) {
        return escapeHtml(line);
    }

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

function renderContent(keyword = '') {
    const lines = rawText.split(/\r?\n/);
    const lessonLineRegex = /^第\s*(\d{1,2})课([^\n]*)$/;
    const majorSectionRegex = /^(?:[一二三四五六七八九十]+、\s*(?:听力|阅读|书写|复习)|听力|阅读|书写|复习)$/;
    const subSectionRegex = /^第\s*[一二三四五六七八九十]+\s*部分(?:.*)?$/;
    const examTitleRegex = /^HSK\(三级\)模拟试卷$/;
    const footerLineRegex = /^Giáo\s*trình\s*chuẩn\s*HSK\s*3\s*[–-]\s*Đáp\s*án\s*sách\s*bài\s*tập\s*[-–]?\s*Trang\s*\d+$/i;

    let html = '';
    let lessonOpen = false;
    let majorOpen = false;
    let subOpen = false;
    let introOpen = false;
    let examOpen = false;

    function openIntro() {
        if (!introOpen) {
            html += '<div class="intro-block">';
            introOpen = true;
        }
    }

    function closeIntro() {
        if (introOpen) {
            html += '</div>';
            introOpen = false;
        }
    }

    function openExam() {
        if (!examOpen) {
            html += '<div class="exam-block">';
            examOpen = true;
        }
    }

    function closeExam() {
        if (examOpen) {
            html += '</div>';
            examOpen = false;
        }
    }

    function closeSub() {
        if (subOpen) {
            html += '</div>';
            subOpen = false;
        }
    }

    function closeMajor() {
        closeSub();
        if (majorOpen) {
            html += '</div>';
            majorOpen = false;
        }
    }

    function closeLesson() {
        closeMajor();
        if (lessonOpen) {
            html += '</div>';
            lessonOpen = false;
        }
    }

    function lineClassFor(text) {
        if (!text.trim()) {
            return 'line empty';
        }
        if (/^参考答案[:：]?$/.test(text.trim())) {
            return 'line answer-line';
        }
        if (/Trang\s+\d+/i.test(text)) {
            return 'line page-line';
        }
        if (examTitleRegex.test(text.trim())) {
            return 'line exam-title';
        }
        return 'line';
    }

    lines.forEach((line) => {
        const lessonMatchLocal = line.match(lessonLineRegex);
        const trimmed = line.trim();

        if (footerLineRegex.test(trimmed)) {
            return;
        }

        if (lessonMatchLocal) {
            closeIntro();
            closeExam();
            closeLesson();

            const n = Number(lessonMatchLocal[1]);
            lessonOpen = true;
            html += `<div class="lesson-block"><div id="lesson-${n}" class="lesson-heading">${highlightText(line, keyword)}</div>`;
            return;
        }

        if (examTitleRegex.test(trimmed)) {
            closeLesson();
            closeIntro();
            openExam();
            html += `<div class="${lineClassFor(line)}">${highlightText(line, keyword)}</div>`;
            return;
        }

        if (!lessonOpen && !examOpen) {
            openIntro();
            html += `<div class="${lineClassFor(line)}">${highlightText(line, keyword)}</div>`;
            return;
        }

        if (lessonOpen && majorSectionRegex.test(trimmed)) {
            closeSub();
            if (majorOpen) {
                html += '</div>';
            }
            majorOpen = true;
            html += `<div class="major-section"><div class="major-heading">${highlightText(line, keyword)}</div>`;
            return;
        }

        if (lessonOpen && subSectionRegex.test(trimmed)) {
            closeSub();
            if (!majorOpen) {
                majorOpen = true;
                html += '<div class="major-section">';
            }
            subOpen = true;
            html += `<div class="sub-section"><div class="sub-heading">${highlightText(line, keyword)}</div>`;
            return;
        }

        html += `<div class="${lineClassFor(line)}">${highlightText(line, keyword)}</div>`;
    });

    closeIntro();
    closeExam();
    closeLesson();

    content.innerHTML = html;
}

function renderLessonOptions() {
    lessonSelect.innerHTML = lessonNumbers
        .map((n) => `<option value="${n}">Bài ${n}: ${escapeHtml(lessonMap.get(n) || '')}</option>`)
        .join('');

    quickLessons.innerHTML = lessonNumbers
        .map((n) => `<button type="button" class="quick-lesson" data-lesson="${n}">${n}</button>`)
        .join('');
}

function setCurrentLesson(lessonNumber) {
    if (!lessonNumbers.includes(lessonNumber)) {
        return;
    }

    currentLesson = lessonNumber;
    lessonSelect.value = String(lessonNumber);

    document.querySelectorAll('.quick-lesson').forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.lesson) === lessonNumber);
    });

    const idx = lessonNumbers.indexOf(lessonNumber);
    prevLessonBtn.disabled = idx <= 0;
    nextLessonBtn.disabled = idx >= lessonNumbers.length - 1;
}

function goToLesson(lessonNumber, smooth = true) {
    setCurrentLesson(lessonNumber);
    const anchor = document.getElementById(`lesson-${lessonNumber}`);
    if (anchor) {
        anchor.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    }
}

renderContent('');
renderLessonOptions();
setCurrentLesson(currentLesson);

searchBox.addEventListener('input', function () {
    renderContent(this.value.trim());
    setCurrentLesson(currentLesson);
});

lessonSelect.addEventListener('change', function () {
    goToLesson(Number(this.value));
});

goLessonBtn.addEventListener('click', function () {
    goToLesson(Number(lessonSelect.value));
});

quickLessons.addEventListener('click', function (event) {
    const target = event.target.closest('.quick-lesson');
    if (!target) {
        return;
    }
    goToLesson(Number(target.dataset.lesson));
});

prevLessonBtn.addEventListener('click', function () {
    const idx = lessonNumbers.indexOf(currentLesson);
    if (idx > 0) {
        goToLesson(lessonNumbers[idx - 1]);
    }
});

nextLessonBtn.addEventListener('click', function () {
    const idx = lessonNumbers.indexOf(currentLesson);
    if (idx < lessonNumbers.length - 1) {
        goToLesson(lessonNumbers[idx + 1]);
    }
});

window.addEventListener('scroll', function () {
    backToTopBtn.classList.toggle('show', window.scrollY > 300);
});

backToTopBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
