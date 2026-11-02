// Strategy export: a clean, print-ready sheet (not a screenshot of the app) saved as PNG or PDF.
// The sheet is built off-screen from previewData, so what lands in the file is always the full plan:
// race summary, drivers, every stint with clock times and laps, pit stops, and the rule check.

(function() {
    const esc = function(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
    const tr = function(k, fb) { const v = window.t ? window.t(k) : null; return (v && v !== k) ? v : fb; };
    const hm = function(ms) { return window.fmtHM(ms); };
    const um = function() { const v = window.t ? window.t('unitMin') : 'm'; return v && v !== 'unitMin' ? v : 'm'; };
    const clock = function(d) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    const dayOf = function(d) { return new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); };

    const INK = '#0f172a', MUTE = '#64748b', LINE = '#e2e8f0', SOFT = '#f1f5f9', ACCENT = '#0e7490';

    window._buildExportSheet = function() {
        const pd = window.previewData;
        if (!pd || !pd.timeline || !pd.timeline.length) return null;
        const cfg = window.config || {};
        const rtl = document.documentElement.dir === 'rtl';
        const stints = pd.timeline.filter(function(x) { return x.type === 'stint'; });
        const pits = pd.timeline.filter(function(x) { return x.type === 'pit'; });
        const driveMs = stints.reduce(function(a, s) { return a + s.duration; }, 0);
        const pitMs = pits.reduce(function(a, p) { return a + p.duration; }, 0);
        const start = new Date(pd.startTime || Date.now());
        const end = new Date(start.getTime() + driveMs + pitMs);
        const lapMs = cfg.raceTarget === 'laps' && cfg.avgLapSec > 0 ? cfg.avgLapSec * 1000 : 0;
        const laps = function(ms) { return lapMs ? Math.round(ms / lapMs) : null; };
        const verdict = typeof window.checkCompliance === 'function' ? window.checkCompliance(pd.timeline, cfg) : null;
        const place = (window._venueWeather && window._venueWeather.locationName) || document.getElementById('raceLocation')?.value || '';

        // per-driver totals
        const per = {};
        stints.forEach(function(s) {
            const k = s.driverName;
            if (!per[k]) per[k] = { ms: 0, n: 0, color: s.color };
            per[k].ms += s.duration; per[k].n++;
        });

        const target = lapMs ? (cfg.raceLaps + ' ' + tr('laps', 'laps')) : hm((cfg.raceMs || driveMs + pitMs));
        const kpi = function(label, value) {
            return '<div style="flex:1;min-width:0;background:' + SOFT + ';border-radius:10px;padding:12px 14px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTE + '">' + esc(label) + '</div><div style="font-size:22px;font-weight:800;color:' + INK + ';margin-top:2px">' + esc(value) + '</div></div>';
        };

        let rows = '', t = start.getTime();
        stints.forEach(function(s, i) {
            const a = t, b = t + s.duration;
            t = b;
            const pit = pits[i];
            let pitCell = '';
            if (pit && i < stints.length - 1) { pitCell = pit.duration > 0 ? '+' + Math.round(pit.duration / 1000) + 's' : tr('pitNoun', 'Pit'); t += pit.duration; }
            const l = laps(s.duration);
            rows += '<tr class="xrow" style="border-top:1px solid ' + LINE + '">'
                + '<td style="padding:9px 8px;color:' + MUTE + ';width:34px">' + (i + 1) + '</td>'
                + '<td style="padding:9px 8px;font-weight:700;color:' + INK + '"><span style="display:inline-block;vertical-align:middle;width:10px;height:10px;border-radius:50%;background:' + esc(s.color || '#22d3ee') + ';margin-' + (rtl ? 'left' : 'right') + ':8px"></span>' + esc(s.driverName) + '</td>'
                + '<td style="padding:9px 8px;font-variant-numeric:tabular-nums">' + clock(a) + ' – ' + clock(b) + '</td>'
                + '<td style="padding:9px 8px;font-weight:700;font-variant-numeric:tabular-nums">' + Math.round(s.duration / 60000) + um() + '</td>'
                + (lapMs ? '<td style="padding:9px 8px;font-variant-numeric:tabular-nums">≈ ' + l + '</td>' : '')
                + '<td style="padding:9px 8px;color:' + MUTE + '">' + pitCell + '</td></tr>';
        });

        const driverRows = Object.keys(per).map(function(name) {
            const d = per[name], share = driveMs ? Math.round(d.ms / driveMs * 100) : 0;
            return '<tr class="xrow" style="border-top:1px solid ' + LINE + '"><td style="padding:8px"><span style="display:inline-block;vertical-align:middle;width:10px;height:10px;border-radius:50%;background:' + esc(d.color) + ';margin-' + (rtl ? 'left' : 'right') + ':8px"></span><b>' + esc(name) + '</b></td>'
                + '<td style="padding:8px">' + hm(d.ms) + '</td><td style="padding:8px">' + d.n + '</td>'
                + '<td style="padding:8px;width:34%"><div style="height:8px;border-radius:4px;background:' + LINE + '"><div style="height:8px;border-radius:4px;width:' + share + '%;background:' + esc(d.color) + '"></div></div></td>'
                + '<td style="padding:8px;color:' + MUTE + '">' + share + '%</td></tr>';
        }).join('');

        const ruleRows = verdict && verdict.items.length ? verdict.items.map(function(i) {
            return '<div class="xrow" style="padding:6px 0;border-top:1px solid ' + LINE + ';color:' + (i.ok ? INK : '#b91c1c') + '"><b style="color:' + (i.ok ? '#15803d' : '#b91c1c') + '">' + (i.ok ? '✓' : '✗') + '</b>&nbsp; ' + esc(i.text) + '</div>';
        }).join('') : '';

        const th = function(x) { return '<th style="padding:8px;text-align:' + (rtl ? 'right' : 'left') + ';font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTE + ';font-weight:700">' + esc(x) + '</th>'; };
        const h2 = function(x) { return '<div class="xrow" style="font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:' + ACCENT + ';font-weight:800;margin:26px 0 8px">' + esc(x) + '</div>'; };

        const sheet = document.createElement('div');
        sheet.id = 'exportSheet';
        sheet.dir = rtl ? 'rtl' : 'ltr';
        sheet.style.cssText = 'position:absolute;left:-12000px;top:0;width:1100px;box-sizing:border-box;padding:44px 48px;background:#fff;color:' + INK + ';font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.35';
        sheet.innerHTML =
            '<div class="xrow" style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ' + ACCENT + ';padding-bottom:14px">'
            + '<div><div style="font-size:12px;letter-spacing:.2em;color:' + ACCENT + ';font-weight:800">STRATEGER</div>'
            + '<div style="font-size:30px;font-weight:900;margin-top:4px">' + esc(tr('xExpTitle', 'Race strategy')) + (place ? ' · ' + esc(place) : '') + '</div></div>'
            + '<div style="text-align:' + (rtl ? 'left' : 'right') + ';color:' + MUTE + '"><div style="font-weight:700;color:' + INK + '">' + dayOf(start) + '</div><div>' + clock(start) + ' → ' + clock(end) + '</div></div></div>'
            + '<div class="xrow" style="display:flex;gap:10px;margin-top:20px">'
            + kpi(tr('lblRaceTarget', 'Race'), target)
            + kpi(tr('stints', 'Stints'), String(stints.length))
            + kpi(tr('pitNoun', 'Pit stops'), String(pits.length))
            + kpi(tr('avgStint', 'Avg stint'), stints.length ? Math.round(driveMs / stints.length / 60000) + um() : '—')
            + kpi(tr('driveNoun', 'Driving'), hm(driveMs))
            + '</div>'
            + h2(tr('xExpDrivers', 'Drivers'))
            + '<table style="width:100%;border-collapse:collapse"><thead><tr>' + th(tr('ltDriver', 'Driver')) + th(tr('driveNoun', 'Driving')) + th(tr('stints', 'Stints')) + th('') + th('%') + '</tr></thead><tbody>' + driverRows + '</tbody></table>'
            + h2(tr('timeline', 'Timeline'))
            + '<table style="width:100%;border-collapse:collapse"><thead><tr>' + th('#') + th(tr('ltDriver', 'Driver')) + th(tr('xTimes', 'Time')) + th(tr('xDuration', 'Duration')) + (lapMs ? th(tr('laps', 'Laps')) : '') + th(tr('pitNoun', 'Pit')) + '</tr></thead><tbody>' + rows + '</tbody></table>'
            + (ruleRows ? h2(verdict.failing.length ? window.tf('cpBroken', { n: verdict.failing.length }) : tr('cpAllMet', 'All rules met')) + ruleRows : '')
            + '<div class="xrow" style="margin-top:28px;padding-top:10px;border-top:1px solid ' + LINE + ';color:' + MUTE + ';font-size:11px;display:flex;justify-content:space-between"><span>Strateger</span><span>' + esc(new Date().toLocaleString()) + '</span></div>';
        document.body.appendChild(sheet);
        return sheet;
    };

    async function renderSheet() {
        if (typeof window.recalculateTimelineTimes === 'function') window.recalculateTimelineTimes();
        const sheet = window._buildExportSheet();
        if (!sheet) throw new Error(tr('xNoStrategy', 'No strategy to export yet'));
        // make sure webfonts/layout are settled before measuring
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });
        const rowEnds = Array.prototype.map.call(sheet.querySelectorAll('.xrow'), function(r) {
            const box = r.getBoundingClientRect(), root = sheet.getBoundingClientRect();
            return Math.round(box.bottom - root.top);
        });
        const canvas = await html2canvas(sheet, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false, width: 1100, windowWidth: 1100 });
        sheet.remove();
        return { canvas: canvas, rowEnds: rowEnds };
    }

    function busy(btn, on) {
        if (!btn) return function() {};
        const html = btn.innerHTML;
        if (on) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        return function() { btn.disabled = false; btn.innerHTML = html; };
    }

    window.exportStrategyImage = async function() {
        if (!window.checkProFeature('pdfExport')) { window.showProGate('Image Export'); return; }
        if (typeof html2canvas === 'undefined') { window.showToast(tr('xExportUnavailable', 'Export not available. Please try again.'), 'error'); return; }
        const done = busy(document.activeElement && document.activeElement.closest && document.activeElement.closest('button'), true);
        try {
            const out = await renderSheet();
            const link = document.createElement('a');
            link.download = 'strateger-strategy-' + Date.now() + '.png';
            link.href = out.canvas.toDataURL('image/png');
            document.body.appendChild(link); link.click(); link.remove();
        } catch (e) {
            console.error('Image export failed:', e);
            window.showToast('Export failed: ' + e.message, 'error');
        } finally { done(); document.getElementById('exportSheet')?.remove(); }
    };

    window.exportStrategyPdf = async function() {
        if (!window.checkProFeature('pdfExport')) { window.showProGate('PDF Export'); return; }
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') { window.showToast(tr('xPdfUnavailable', 'PDF export not available. Please try again.'), 'error'); return; }
        const done = busy(document.activeElement && document.activeElement.closest && document.activeElement.closest('button'), true);
        try {
            const out = await renderSheet();
            const canvas = out.canvas, S = 2;
            const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
            const margin = 18, drawW = pageW - margin * 2;
            const ptPerPx = drawW / 1100;                         // sheet px -> pt
            const pagePx = Math.floor((pageH - margin * 2 - 14) / ptPerPx);   // sheet px per page
            const totalPx = Math.round(canvas.height / S);
            const pages = [];
            let from = 0;
            while (from < totalPx - 2) {
                let to = Math.min(from + pagePx, totalPx);
                if (to < totalPx) {
                    const cut = out.rowEnds.filter(function(e) { return e > from + pagePx * 0.4 && e <= to; });
                    if (cut.length) to = cut[cut.length - 1];      // never split a row across pages
                }
                pages.push([from, to]);
                from = to;
            }
            pages.forEach(function(pg, i) {
                if (i > 0) pdf.addPage();
                const h = pg[1] - pg[0];
                const slice = document.createElement('canvas');
                slice.width = canvas.width; slice.height = h * S;
                const ctx = slice.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, slice.width, slice.height);
                ctx.drawImage(canvas, 0, pg[0] * S, canvas.width, h * S, 0, 0, canvas.width, h * S);
                pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, drawW, h * ptPerPx);
                pdf.setFontSize(8); pdf.setTextColor(120);
                pdf.text((i + 1) + ' / ' + pages.length, pageW / 2, pageH - 10, { align: 'center' });
            });
            pdf.save('strateger-strategy-' + Date.now() + '.pdf');
        } catch (e) {
            console.error('PDF export failed:', e);
            window.showToast('PDF export failed: ' + e.message, 'error');
        } finally { done(); document.getElementById('exportSheet')?.remove(); }
    };
})();
