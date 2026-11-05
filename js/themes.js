// ==========================================
// 🎨 APPEARANCE — colour themes
// One registry drives everything: the picker, the live preview and the actual recolouring.
// A theme is a page background plus a 4-colour palette [main, panel, border, accent].
// Applying a theme only sets CSS variables on <html> (see :root in style.css and the
// tailwind.config in index.html, where navy-*, gray-600/700/800 and ice read those
// variables), so every screen, modal and menu changes colour on phone, tablet and desktop.
// Loaded in <head> so a saved theme paints before the first frame (no flash).
// ==========================================
(function () {
    'use strict';

    const KEY = 'strateger_bg';
    const DEFAULT_ACCENT = '#22d3ee';

    // ---------- colour helpers ----------
    const toRgb = (h) => {
        h = String(h).replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const WHITE = [255, 255, 255];
    const trip = (a) => a.join(' ');

    // ---------- registry ----------
    const OVERLAY = 'linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62))';
    const photo = (id) => ({
        bg: `background-image: ${OVERLAY}, url(https://images.unsplash.com/${id}?auto=format&fit=crop&w=1920&q=70); background-size: cover; background-position: center; background-repeat: no-repeat;`,
        img: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=60`,
    });
    // [id, emoji, English name (translated through tt), group, palette, background css, optional small-swatch css]
    const T = (id, emoji, name, group, pal, bg, pv) => ({ id, emoji, name, group, pal, bg, pv: pv || bg });
    const tarmacSvg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23181818'/%3E%3Crect width='1' height='1' fill='%23202020'/%3E%3Crect width='1' height='1' x='2' y='2' fill='%23141414'/%3E%3C/svg%3E\")";

    const THEMES = [
        // ----- Classic -----
        T('', '🏁', 'Default', 'classic', ['#020617', '#0f172a', '#1e293b', '#22d3ee'], '', 'background: linear-gradient(135deg, #020617 50%, #1e293b 100%);'),
        T('black', '⚫', 'Pure Black', 'classic', ['#000000', '#0a0a0a', '#1a1a1a', '#22d3ee'], 'background: #000000;'),
        T('carbon', '🧬', 'Carbon', 'classic', ['#0a0a0a', '#141414', '#252525', '#22d3ee'],
            'background: repeating-linear-gradient(45deg, #0a0a0a, #0a0a0a 3px, #161616 3px, #161616 6px);',
            'background: repeating-linear-gradient(45deg, #0a0a0a, #0a0a0a 2px, #151515 2px, #151515 4px);'),
        T('tarmac', '🛣️', 'Tarmac', 'classic', ['#141414', '#1a1a1a', '#2a2a2a', '#22d3ee'],
            `background-color:#181818; background-image: ${tarmacSvg}, linear-gradient(180deg, transparent 47%, rgba(255,255,255,0.15) 49%, rgba(255,255,255,0.15) 51%, transparent 53%);`),
        T('checkered', '🏁', 'Flag', 'classic', ['#0e0e0e', '#181818', '#2a2a2a', '#f1f5f9'],
            'background-color:#111; background-image: repeating-conic-gradient(#1a1a1a 0% 25%, #111 0% 50%); background-size: 20px 20px;',
            'background-color:#111; background-image: repeating-conic-gradient(#222 0% 25%, #111 0% 50%); background-size: 10px 10px;'),
        T('pit-lane', '⚠️', 'Pit Lane', 'classic', ['#0c0c0c', '#161610', '#2a2a1a', '#facc15'],
            'background: linear-gradient(180deg, #0c0c0c 0%, #0c0c0c 92%, transparent 92%), repeating-linear-gradient(90deg, #d4a017 0px, #d4a017 10px, #111 10px, #111 20px); background-color: #0c0c0c;',
            'background: linear-gradient(180deg, #0c0c0c 0%, #0c0c0c 80%, transparent 80%), repeating-linear-gradient(90deg, #d4a017 0px, #d4a017 6px, #111 6px, #111 12px); background-color: #0c0c0c;'),

        // ----- Dark tones -----
        T('night-circuit', '🌙', 'Night', 'dark', ['#050a12', '#0a1225', '#1a2545', '#22d3ee'],
            'background: radial-gradient(ellipse at 30% 80%, rgba(34,211,238,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(168,85,247,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 0%, #050a12 100%); background-color: #050a12;'),
        T('midnight-blue', '🌊', 'Midnight', 'dark', ['#020820', '#081535', '#102050', '#60a5fa'],
            'background: linear-gradient(180deg, #020820 0%, #0a1640 50%, #020820 100%);'),
        T('deep-red', '🔴', 'Deep Red', 'dark', ['#1a0505', '#220808', '#401515', '#fb7185'],
            'background: linear-gradient(180deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%);'),
        T('forest', '🌲', 'Forest', 'dark', ['#051a0a', '#082510', '#104020', '#4ade80'],
            'background: linear-gradient(180deg, #051a0a 0%, #0a2d15 50%, #051a0a 100%);'),
        T('purple-night', '🟣', 'Purple', 'dark', ['#0d0520', '#150a30', '#251545', '#c084fc'],
            'background: linear-gradient(180deg, #0d0520 0%, #1a0a35 50%, #0d0520 100%);'),
        T('hot-pink', '🌸', 'Pink', 'dark', ['#150510', '#1e0818', '#3a1030', '#f472b6'],
            'background: linear-gradient(180deg, #150005 0%, #250a1a 30%, #3a0a28 50%, #250a1a 70%, #150005 100%);'),
        T('amber-heat', '🔥', 'Amber', 'dark', ['#1a1000', '#221805', '#403015', '#fbbf24'],
            'background: linear-gradient(180deg, #1a1000 0%, #2d1a05 50%, #1a1000 100%);'),
        T('sunset-racing', '🌅', 'Sunset', 'dark', ['#1a0520', '#250a18', '#401530', '#fb923c'],
            'background: linear-gradient(180deg, #1a0520 0%, #2d0a15 25%, #4a1a08 50%, #2d0a15 75%, #1a0520 100%);'),
        T('stripes-red', '🏎️', 'Racing Red', 'dark', ['#0e0202', '#180505', '#3a1010', '#f87171'],
            'background: linear-gradient(180deg, #080000 0%, #150303 35%, #2a0505 48%, #cc0000 49.5%, #cc0000 50.5%, #2a0505 52%, #cc0000 55%, #cc0000 55.5%, #150303 57%, #080000 100%);'),
        T('martini-stripe', '🍸', 'Martini', 'dark', ['#0e0e14', '#15151e', '#252535', '#60a5fa'],
            'background: linear-gradient(180deg, #0e0e14 0%, #0e0e14 44%, #1a3a6e 44.5%, #1a3a6e 47%, #cc2222 47.5%, #cc2222 50.5%, #1a3a6e 51%, #1a3a6e 53.5%, #0e0e14 54%, #0e0e14 100%);'),
        T('ferrari-rosso', '🐎', 'Ferrari', 'dark', ['#0e0000', '#1a0505', '#3a1010', '#f87171'],
            'background: linear-gradient(180deg, #0e0000 0%, #2a0808 25%, #4a0a0a 50%, #2a0808 75%, #0e0000 100%);'),
        T('mclaren-papaya', '🧡', 'Papaya', 'dark', ['#100800', '#1a1208', '#352510', '#fb923c'],
            'background: linear-gradient(180deg, #100800 0%, #201505 25%, #3a2008 40%, #4a2a0a 50%, #3a2008 60%, #201505 75%, #100800 100%);'),
        T('volcanic', '🌋', 'Volcanic', 'dark', ['#0a0000', '#150500', '#301008', '#f97316'],
            'background: linear-gradient(180deg, #0a0000 0%, #1a0500 20%, #2d0800 35%, #401005 50%, #2d0800 65%, #1a0500 80%, #0a0000 100%);'),
        T('neon-grid', '🔲', 'Neon', 'dark', ['#050510', '#0a0a1a', '#0f2a25', '#2dd4bf'],
            'background-color:#050510; background-image: linear-gradient(rgba(0,255,200,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.05) 1px, transparent 1px); background-size: 40px 40px;',
            'background-color:#050510; background-image: linear-gradient(rgba(0,255,200,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.1) 1px, transparent 1px); background-size: 8px 8px;'),

        // ----- Vivid -----
        T('ice-blue', '🧊', 'Ice', 'vivid', ['#001020', '#002040', '#0044aa', '#7dd3fc'],
            'background: linear-gradient(180deg, #001830 0%, #003060 25%, #0055aa 50%, #003060 75%, #001830 100%);'),
        T('teal-circuit', '🦚', 'Teal', 'vivid', ['#001515', '#003535', '#007070', '#5eead4'],
            'background: linear-gradient(180deg, #001a1a 0%, #005555 25%, #00a0a0 50%, #005555 75%, #001a1a 100%);'),
        T('bronze-age', '🥉', 'Bronze', 'vivid', ['#120a00', '#3a1e00', '#7a4400', '#fbbf24'],
            'background: linear-gradient(180deg, #1a0e00 0%, #5c3300 25%, #a05a00 50%, #5c3300 75%, #1a0e00 100%);'),
        T('toxic-green', '☢️', 'Toxic', 'vivid', ['#001000', '#003300', '#006600', '#a3e635'],
            'background: linear-gradient(180deg, #001500 0%, #004400 25%, #009900 50%, #004400 75%, #001500 100%);'),
        T('royal-navy', '👑', 'Royal', 'vivid', ['#000025', '#000060', '#1515aa', '#93c5fd'],
            'background: linear-gradient(180deg, #000033 0%, #000088 25%, #1a1acc 50%, #000088 75%, #000033 100%);'),
        T('blood-moon', '🌑', 'Blood Moon', 'vivid', ['#1a0000', '#440000', '#880000', '#fca5a5'],
            'background: radial-gradient(ellipse at 50% 35%, #cc0000 0%, #660000 45%, #1a0000 100%);'),
        T('solar-flare', '☀️', 'Solar', 'vivid', ['#1a0800', '#3a1500', '#883300', '#fcd34d'],
            'background: linear-gradient(180deg, #1a0d00 0%, #cc6600 30%, #ff9900 50%, #cc6600 70%, #1a0d00 100%);'),
        T('electric-yellow', '⚡', 'Lightning', 'vivid', ['#0e0e00', '#222200', '#666600', '#fde047'],
            'background: linear-gradient(180deg, #111100 0%, #555500 25%, #aaaa00 50%, #555500 75%, #111100 100%);'),
        T('cyan-surge', '💠', 'Cyan', 'vivid', ['#001212', '#004444', '#007777', '#67e8f9'],
            'background: linear-gradient(180deg, #001515 0%, #00aaaa 40%, #00ffff 50%, #00aaaa 60%, #001515 100%);'),
        T('magenta-wave', '🪩', 'Magenta', 'vivid', ['#100010', '#330033', '#770077', '#f0abfc'],
            'background: linear-gradient(180deg, #150015 0%, #880088 30%, #cc00cc 50%, #880088 70%, #150015 100%);'),
        T('silver-chrome', '🪞', 'Chrome', 'vivid', ['#0a0a0a', '#1e1e1e', '#555555', '#e5e7eb'],
            'background: linear-gradient(180deg, #0a0a0a 0%, #404040 25%, #aaaaaa 50%, #404040 75%, #0a0a0a 100%);'),
        T('jade-dragon', '🐉', 'Jade', 'vivid', ['#001209', '#003318', '#006633', '#6ee7b7'],
            'background: linear-gradient(180deg, #001a0d 0%, #006633 30%, #00cc66 50%, #006633 70%, #001a0d 100%);'),

        // ----- Photo (Pro, needs internet). Palettes stay near-black so the UI is readable over any photo. -----
        Object.assign(T('kart-race', '🏎️', 'Race', 'photo', ['#050505', '#0c0c0c', '#222222', '#f87171']), photo('photo-1558618666-fcd25c85cd64')),
        Object.assign(T('kart-night', '🌙', 'Night Race', 'photo', ['#03060e', '#08101e', '#1a2030', '#22d3ee']), photo('photo-1568605117036-5fe5e7bab0b7')),
        Object.assign(T('kart-pit', '🔧', 'Pit Stop', 'photo', ['#060606', '#0e0e0e', '#202020', '#facc15']), photo('photo-1541348263662-e068662d82af')),
        Object.assign(T('kart-onboard', '🎥', 'Onboard', 'photo', ['#050505', '#0c0c0c', '#1e1e1e', '#22d3ee']), photo('photo-1503376780353-7e6692767b70')),
        Object.assign(T('kart-wet', '🌧️', 'Wet Race', 'photo', ['#050810', '#0a1020', '#182030', '#7dd3fc']), photo('photo-1543466835-00a7b8755b4c')),
        Object.assign(T('kart-grid', '🚦', 'Starting Grid', 'photo', ['#060505', '#100a0a', '#201515', '#f87171']), photo('photo-1504707748692-419802cf939d')),
        Object.assign(T('kart-blaze', '💨', 'Speed Blaze', 'photo', ['#080403', '#100806', '#201410', '#fb923c']), photo('photo-1583394293214-fb28a5a16b6d')),
        Object.assign(T('kart-helmet', '🪖', 'Helmet', 'photo', ['#050505', '#0c0c0c', '#202020', '#22d3ee']), photo('photo-1594398901-e69f3a2c1e23')),
    ];
    const BY_ID = {};
    THEMES.forEach(t => { BY_ID[t.id] = t; });
    const GROUPS = [
        ['classic', '🏁', 'Classic'],
        ['dark', '🌙', 'Dark tones'],
        ['vivid', '🎨', 'Vivid'],
        ['photo', '📸', 'Photo'],
    ];

    const isPro = () => !!(window._proUnlocked || window._trialActive);
    const tr = (s) => (typeof window.tt === 'function' ? window.tt(s) : s);
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage full / blocked */ } };

    // ---------- palette -> CSS variables ----------
    function vars(pal) {
        const main = toRgb(pal[0]), panel = toRgb(pal[1]), border = toRgb(pal[2]);
        const accent = toRgb(pal[3] || DEFAULT_ACCENT);
        return {
            '--n950': trip(main),
            '--n900': trip(panel),
            '--n800': trip(mix(panel, border, 0.5)),
            '--n700': trip(mix(border, WHITE, 0.1)),
            '--g600': trip(mix(border, WHITE, 0.2)),
            '--g700': trip(border),
            '--g800': trip(mix(panel, border, 0.6)),
            '--accent-rgb': trip(accent),
            '--theme-main': pal[0],
            '--theme-panel': pal[1],
            '--theme-border': pal[2],
        };
    }
    const ORIGINAL_META = (function () {
        const m = document.querySelector('meta[name="theme-color"]');
        return m ? m.getAttribute('content') : null;
    })();

    function setBodyBg(css) {
        let el = document.getElementById('themeBgStyle');
        if (!css) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('style');
            el.id = 'themeBgStyle';
            (document.head || document.documentElement).appendChild(el);
        }
        // `html body[class]` outranks the .bg-navy-950 class that body carries.
        el.textContent = `html body[class]{${css.replace(/;\s*$/, '')}}`;
    }

    function paint(theme, bgOverride) {
        const root = document.documentElement;
        const isDefault = !theme || theme.id === '';
        const v = vars((theme || THEMES[0]).pal);
        Object.keys(v).forEach(k => (isDefault ? root.style.removeProperty(k) : root.style.setProperty(k, v[k])));
        if (isDefault) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme.id);
        setBodyBg(bgOverride || (isDefault ? '' : theme.bg));
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDefault ? (ORIGINAL_META || '#22d3ee') : theme.pal[1]);
    }

    // ---------- public API ----------
    window.THEMES = THEMES;
    window.getTheme = () => safeGet(KEY) || '';

    /**
     * Apply a theme. opts.restore = silent startup restore (no Pro gate / toast / panel close).
     */
    window.setPageBackground = function (id, opts) {
        opts = opts || {};
        id = id || '';

        if (id === 'custom-photo') {
            const dataUrl = safeGet('strateger_custom_photo');
            if (!isPro() || !dataUrl) {
                if (!opts.restore && !isPro() && typeof window.showProGate === 'function') window.showProGate('Custom Photo');
                return;
            }
            // Custom photo keeps the near-black palette so text stays readable
            paint(Object.assign({}, BY_ID['kart-race'], { id: 'custom-photo' }), `background-image: ${OVERLAY}, url("${dataUrl}"); background-size: cover; background-position: center; background-attachment: fixed; background-repeat: no-repeat;`);
            safeSet(KEY, id);
            afterApply(id, opts);
            return;
        }

        let theme = BY_ID[id];
        if (!theme) {
            // Legacy saved values (old raw colours) -> default
            theme = BY_ID[''];
            id = '';
        }
        if (theme.group === 'photo' && !isPro()) {
            if (opts.restore) { paint(BY_ID['']); return; }
            if (typeof window.showProGate === 'function') window.showProGate('Photo Themes');
            if (typeof window.showToast === 'function') window.showToast(tr('Photo themes are available for Pro users'), 'warning', 2500);
            return;
        }
        paint(theme);
        safeSet(KEY, id);
        afterApply(id, opts);
    };

    function afterApply(id, opts) {
        markActive(id);
        drawPreview(BY_ID[id] || (id === 'custom-photo' ? BY_ID['kart-race'] : BY_ID['']));
        if (opts.restore) return;
        const tp = document.getElementById('themePanel');
        // Phones: the sheet hides the app, so close it to reveal the result. Larger screens stay open to compare.
        if (tp && !tp.classList.contains('hidden') && window.matchMedia('(max-width: 639px)').matches) {
            setTimeout(() => tp.classList.add('hidden'), 280);
        }
    }

    // ---------- picker UI ----------
    let activeGroup = 'all';

    function previewHtml(t) {
        const [main, panel, border, accent] = t.pal;
        const bg = t.img ? t.bg : t.pv;
        return `<div class="tp-mock-stage" style="${bg}">
            <div class="tp-mock-app" style="background:${main};border-color:${border}">
                <div class="tp-mock-bar" style="background:${panel};border-color:${border}">
                    <i style="background:${accent}"></i><b style="background:${border}"></b><b style="background:${border};width:18%;margin-inline-start:auto"></b>
                </div>
                <div class="tp-mock-body">
                    <div class="tp-mock-card" style="background:${panel};border-color:${border}">
                        <b style="background:${accent};width:38%"></b><b style="background:${border}"></b><b style="background:${border};width:70%"></b>
                        <span style="background:${accent}"></span>
                    </div>
                    <div class="tp-mock-card" style="background:${panel};border-color:${border}">
                        <b style="background:${border};width:55%"></b>
                        <u style="background:${border}"><s style="background:${accent}"></s></u>
                        <b style="background:${border};width:45%"></b>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function drawPreview(t) {
        const box = document.getElementById('tpPreview');
        if (!box || !t) return;
        box.innerHTML = previewHtml(t) + `<div class="tp-mock-name"><span>${t.emoji}</span> ${esc(tr(t.name))}</div>`;
    }

    function swatchHtml(t, current, locked) {
        const cls = 'theme-swatch bg-swatch' + (t.id === current ? ' active' : '') + (locked ? ' locked' : '');
        const dot = `<i class="tp-sw-dot" style="background:${t.pal[3]}"></i>`;
        const strip = `<i class="tp-sw-strip" style="background:${t.pal[1]};border-color:${t.pal[2]}"></i>`;
        const inner = t.img
            ? `<div class="theme-preview"><img src="${t.img}" alt="" loading="lazy" onerror="this.style.display='none'">${strip}${dot}${locked ? '<i class="fas fa-lock tp-sw-lock"></i>' : ''}</div>`
            : `<div class="theme-preview" style="${t.pv}">${strip}${dot}</div>`;
        return `<button type="button" class="${cls}" role="radio" aria-checked="${t.id === current}" data-bg="${t.id}" title="${esc(tr(t.name))}">
            ${inner}<span class="theme-label">${t.emoji} ${esc(tr(t.name))}</span></button>`;
    }

    function renderPicker() {
        const root = document.getElementById('tpGroups');
        if (!root) return;
        const current = window.getTheme();
        const pro = isPro();
        const chips = document.getElementById('tpChips');
        if (chips) {
            const all = [['all', '', 'All']].concat(GROUPS);
            chips.innerHTML = all.map(g => `<button type="button" role="tab" class="tp-chip${g[0] === activeGroup ? ' on' : ''}" aria-selected="${g[0] === activeGroup}" data-g="${g[0]}">${g[1] ? g[1] + ' ' : ''}${esc(tr(g[2]))}</button>`).join('');
        }
        root.innerHTML = GROUPS.filter(g => activeGroup === 'all' || activeGroup === g[0]).map(g => {
            const list = THEMES.filter(t => t.group === g[0]);
            const note = g[0] === 'photo' ? `<span class="tp-note">${esc(tr('Needs internet'))} · PRO</span>` : '';
            return `<section class="tp-group"><div class="theme-category-label"><span class="theme-category-icon">${g[1]}</span> ${esc(tr(g[2]))}${note}</div>
                <div class="theme-grid" role="radiogroup" aria-label="${esc(tr(g[2]))}">${list.map(t => swatchHtml(t, current, t.group === 'photo' && !pro)).join('')}</div></section>`;
        }).join('');
        syncCustomPhoto(pro);
        drawPreview(BY_ID[current] || (current === 'custom-photo' ? BY_ID['kart-race'] : BY_ID['']));
    }

    function markActive(id) {
        document.querySelectorAll('.bg-swatch').forEach(s => {
            const on = s.dataset.bg === id;
            s.classList.toggle('active', on);
            s.setAttribute('aria-checked', String(on));
        });
    }

    function syncCustomPhoto(pro) {
        const gate = document.getElementById('customPhotoProGate');
        const upload = document.getElementById('customPhotoUploadArea');
        if (gate) gate.classList.toggle('hidden', pro);
        if (upload) upload.classList.toggle('hidden', !pro);
        if (pro) {
            const saved = safeGet('strateger_custom_photo');
            const preview = document.getElementById('customPhotoPreview');
            const img = document.getElementById('customPhotoImg');
            if (saved && preview && img) { img.src = saved; preview.classList.remove('hidden'); }
        }
    }

    window.toggleThemePanel = function () {
        const panel = document.getElementById('themePanel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            renderPicker();
            const scroller = panel.querySelector('.theme-panel-scroll');
            if (scroller) scroller.scrollTop = 0;
            const first = panel.querySelector('.bg-swatch.active') || panel.querySelector('.tp-chip.on');
            if (first && first.focus) first.focus({ preventScroll: true });
        }
    };

    // Delegated events (picker is re-rendered, so no per-swatch handlers)
    document.addEventListener('click', (e) => {
        const sw = e.target.closest && e.target.closest('#themePanel .bg-swatch');
        if (sw) { window.setPageBackground(sw.dataset.bg); return; }
        const chip = e.target.closest && e.target.closest('#themePanel .tp-chip');
        if (chip) { activeGroup = chip.dataset.g; renderPicker(); }
    });
    // Hover/focus previews the palette in the mock app without applying it (mouse + keyboard only)
    function previewFromEvent(e) {
        const sw = e.target.closest && e.target.closest('#themePanel .bg-swatch');
        if (sw && BY_ID[sw.dataset.bg]) drawPreview(BY_ID[sw.dataset.bg]);
    }
    document.addEventListener('mouseover', (e) => { if (window.matchMedia('(hover: hover)').matches) previewFromEvent(e); });
    document.addEventListener('focusin', previewFromEvent);
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest && e.target.closest('#themePanel .theme-grid') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#themePanel .bg-swatch'))) {
            const cur = window.getTheme();
            drawPreview(BY_ID[cur] || (cur === 'custom-photo' ? BY_ID['kart-race'] : BY_ID['']));
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const panel = document.getElementById('themePanel');
        if (panel && !panel.classList.contains('hidden')) window.toggleThemePanel();
    });

    // ---------- custom photo (Pro) ----------
    window.applyCustomPhoto = function (input) {
        if (!isPro()) {
            if (typeof window.showProGate === 'function') window.showProGate('Custom Photo');
            input.value = '';
            return;
        }
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            if (typeof window.showToast === 'function') window.showToast('Photo must be under 5MB', 'warning');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            safeSet('strateger_custom_photo', ev.target.result);
            const preview = document.getElementById('customPhotoPreview');
            const img = document.getElementById('customPhotoImg');
            if (preview && img) { img.src = ev.target.result; preview.classList.remove('hidden'); }
            window.setPageBackground('custom-photo');
        };
        reader.readAsDataURL(file);
    };
    window.clearCustomPhoto = function () {
        try { localStorage.removeItem('strateger_custom_photo'); } catch (e) { /* ignore */ }
        const preview = document.getElementById('customPhotoPreview');
        if (preview) preview.classList.add('hidden');
        const input = document.getElementById('customPhotoInput');
        if (input) input.value = '';
        window.setPageBackground('');
    };

    // ---------- instant restore (before first paint) ----------
    // Photo / custom-photo need Pro status, which isn't known yet: main.js re-applies them later.
    (function early() {
        const saved = safeGet(KEY);
        const t = saved && BY_ID[saved];
        if (t && t.id && t.group !== 'photo') paint(t);
    })();
})();
