// ==========================================
// Live timing from PHOTOS -- for tracks with no timing link (or an old system).
// Upload one or more photos / screenshots of the timing screen:
//   - the first photo BUILDS the standings table (position, kart, name, last/best lap)
//   - every later photo UPDATES it (matched by kart number, else by name)
// Everything downstream (table, our-team cells, stint stats, saving, broadcast) uses the
// same liveData.competitors the real feeds fill, so nothing else needs to know.
// OCR runs in the browser (tesseract.js, already loaded for rules PDFs).
// ==========================================
(function () {
    'use strict';
    const tt = (x) => (window.tt ? window.tt(x) : x);
    const toast = (m, type, ms) => { if (window.showToast) window.showToast(m, type || 'info', ms); };

    // ---------- OCR ----------
    let worker = null;
    async function ocrCanvas(canvas) {
        try {
            if (!worker) {
                worker = await window.Tesseract.createWorker('eng');
                await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
            }
            const r = await worker.recognize(canvas);
            return r.data.text || '';
        } catch (e) {
            worker = null;
            const r = await window.Tesseract.recognize(canvas, 'eng');
            return (r && r.data && r.data.text) || '';
        }
    }

    // Timing screens are usually light text on a dark background, which OCR reads badly:
    // upscale, grey, invert when dark, boost contrast.
    async function prepare(file) {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(3, Math.max(1, 2200 / bmp.width));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(bmp, 0, 0, c.width, c.height);
        const img = g.getImageData(0, 0, c.width, c.height);
        const d = img.data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
            const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = y; sum += y;
        }
        const invert = sum / (d.length / 4) < 120;
        for (let i = 0; i < d.length; i += 4) {
            let v = invert ? 255 - d[i] : d[i];
            v = Math.max(0, Math.min(255, (v - 128) * 1.7 + 128));
            d[i] = d[i + 1] = d[i + 2] = v;
        }
        g.putImageData(img, 0, 0);
        return c;
    }

    // ---------- parsing ----------
    const TIME_RE = /(?<![\d+.:])(?:\d{1,2}:\d{2}[.,]\d{2,3}|\d{2}[.,]\d{3})(?![\d])/g;
    const toMs = (s) => window.parseTimeToMs(s.replace(',', '.'));
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '');

    function parseLine(raw) {
        const line = raw.replace(/[|\[\]{}_~`]/g, ' ').replace(/\s+/g, ' ').trim();
        const pm = line.match(/^(\d{1,3})(?=\s)/);
        if (!pm) return null;
        const position = parseInt(pm[1], 10);
        let rest = line.slice(pm[0].length).trim();
        const times = (rest.match(TIME_RE) || []).map(toMs).filter((x) => x >= 15000 && x <= 600000);
        rest = rest.replace(TIME_RE, ' ').replace(/[+-]\s?\d+[.,:]?\d*/g, ' ').replace(/\s+/g, ' ').trim();
        const tokens = rest.split(' ').filter(Boolean);
        let kart = '';
        if (tokens.length && /^\d{1,3}$/.test(tokens[0]) && tokens.length > 1) kart = tokens.shift();
        const nameTokens = [];
        const nums = [];
        tokens.forEach((tk) => {
            if (/^\d{1,4}$/.test(tk)) nums.push(parseInt(tk, 10));
            else if (/[A-Za-z֐-׿]/.test(tk) && tk.length > 1) nameTokens.push(tk);
        });
        const name = nameTokens.join(' ').trim();
        if (!name && !kart) return null;
        if (!times.length && !name) return null;
        return {
            position, kart, name, team: name, nums,
            lastLap: times.length ? times[0] : 0,
            bestLap: times.length ? Math.min.apply(null, times) : 0
        };
    }

    function parseTable(text) {
        const rows = text.split(/\r?\n/).map(parseLine).filter(Boolean);
        // one row per position (OCR can repeat a header/footer line); keep the one with most data
        const byPos = new Map();
        rows.forEach((r) => {
            const o = byPos.get(r.position);
            if (!o || (r.lastLap ? 1 : 0) + r.name.length > (o.lastLap ? 1 : 0) + o.name.length) byPos.set(r.position, r);
        });
        let out = Array.from(byPos.values()).sort((a, b) => a.position - b.position);
        // a real table has several rows; ignore stray numbers elsewhere on the screen
        if (out.length < 2) return [];
        // laps column: only trust an integer that is present on most rows and never rises down the table
        const lapOf = (r) => (r.nums.length ? Math.max.apply(null, r.nums.filter((n) => n >= 1)) : 0);
        const withLaps = out.filter((r) => lapOf(r) > 0);
        if (withLaps.length >= out.length * 0.8) {
            let ok = true;
            for (let i = 1; i < withLaps.length; i++) if (lapOf(withLaps[i]) > lapOf(withLaps[i - 1]) + 1) ok = false;
            if (ok) out.forEach((r) => { r.laps = lapOf(r) || undefined; r.totalLaps = r.laps; });
        }
        out.forEach((r) => delete r.nums);
        return out;
    }

    // ---------- merge into liveData ----------
    const keyOf = (c) => (c.kart ? 'k' + c.kart : (c.name ? 'n' + norm(c.name) : ''));

    function isOurs(c) {
        const sc = window.searchConfig || {};
        if (sc.kartNumber) return String(c.kart || '').trim() === String(sc.kartNumber).trim();
        const t = norm(sc.teamName || sc.driverName);
        return !!t && !!norm(c.name) && (norm(c.name).includes(t) || t.includes(norm(c.name)));
    }

    function apply(rows) {
        const d = window.liveData;
        const had = (d.competitors || []).length > 0;
        const comps = had ? d.competitors.slice() : [];
        rows.forEach((r) => {
            const k = keyOf(r);
            const ex = k ? comps.find((c) => keyOf(c) === k) : null;
            if (ex) {
                ex.position = r.position;
                if (r.lastLap) ex.lastLap = r.lastLap;
                if (r.bestLap) ex.bestLap = ex.bestLap ? Math.min(ex.bestLap, r.bestLap) : r.bestLap;
                if (r.laps) { ex.laps = r.laps; ex.totalLaps = r.laps; }
                if (!ex.name && r.name) { ex.name = r.name; ex.team = r.team; }
            } else {
                comps.push(r);
            }
        });
        comps.sort((a, b) => a.position - b.position);
        comps.forEach((c) => { c.isOurTeam = isOurs(c); });
        if (typeof window._trackCompetitorStints === 'function') window._trackCompetitorStints(comps);
        d.competitors = comps;

        const us = comps.find((c) => c.isOurTeam);
        if (us) {
            d.previousPosition = d.position;
            d.position = us.position;
            if (us.lastLap) {
                d.lastLap = us.lastLap;
                if (us.lastLap !== d.lastRecordedLap) {
                    (d.stintLapHistory = d.stintLapHistory || []).push(us.lastLap);
                    d.lastRecordedLap = us.lastLap;
                    if (!d.stintBestLap || us.lastLap < d.stintBestLap) d.stintBestLap = us.lastLap;
                }
            }
            if (us.bestLap) d.bestLap = d.bestLap ? Math.min(d.bestLap, us.bestLap) : us.bestLap;
            if (us.laps != null) d.laps = us.laps;
        }
        d.heartbeatCount = (d.heartbeatCount || 0) + 1;
        d.heartbeatAt = Date.now();
        window._lastKnownCompetitors = null;   // rebuild the table from this fresh list
        if (window.liveTimingConfig) window.liveTimingConfig.enabled = true;
        if (typeof window.updateLiveTimingUI === 'function') window.updateLiveTimingUI();
        if (window.state && window.state.isRunning && typeof window.broadcast === 'function') window.broadcast();
        if (typeof window.saveRaceState === 'function') window.saveRaceState();
        return { built: !had, count: comps.length, us: !!us };
    }

    // pick the right team from the "which car is yours" form before reading
    function syncSearchFromForm() {
        const v = document.getElementById('raceLtValue');
        const setup = document.getElementById('searchValue');
        if (v && v.value.trim() && setup) { setup.value = v.value.trim(); if (window.updateSearchConfig) window.updateSearchConfig(); }
    }

    // ---------- public API ----------
    window.readLtPhotos = async function (files) {
        if (window.role === 'client' || window.role === 'viewer') return;
        if (!window.Tesseract) { toast(tt('Photo reading is not available offline'), 'error'); return; }
        syncSearchFromForm();
        const btns = document.querySelectorAll('#ltPhotoBtn, .lt-photo-upload');
        btns.forEach((b) => { b.disabled = true; });
        try {
            for (const f of Array.from(files)) {
                toast(tt('Reading photo…'), 'info', 1800);
                try {
                    const rows = parseTable(await ocrCanvas(await prepare(f)));
                    if (!rows.length) { toast(tt('Could not read a timing table in the photo'), 'error'); continue; }
                    const res = apply(rows);
                    toast(tt(res.built ? 'Table built from photo' : 'Table updated from photo') + ' · ' + res.count, 'success');
                } catch (e) {
                    console.warn('[LivePhoto]', e);
                    toast(tt('Could not read the photo'), 'error');
                }
            }
        } finally {
            btns.forEach((b) => { b.disabled = false; });
        }
    };

    // the existing 📷 button in the live-timing toolbar and the new upload button share this picker
    window.pickLtPhoto = function () {
        const input = document.getElementById('ltPhotoInput');
        if (!input) return;
        input.multiple = true;
        if (!input.dataset.bound2) {
            input.dataset.bound2 = '1';
            input.addEventListener('change', function () {
                const files = input.files ? Array.from(input.files) : [];
                input.value = '';
                if (files.length) window.readLtPhotos(files);
            });
        }
        input.click();
    };
    // legacy single-file entry point
    window.readLtPhoto = function (file) { return window.readLtPhotos([file]); };
})();
