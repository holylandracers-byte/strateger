// Find a venue's live-timing link from its name and the timing system, so nobody has to paste a URL.
// Order: the built-in list, then tracks this device already found, then probing likely slugs through the CORS proxy.

const TF_STORE_KEY = 'strateger_tracks';
const TF_SEED = [
    { name: 'Kart Volan', system: 'racefacer', url: 'https://live.racefacer.com/kartvolan' },
    { name: 'Circuit Tokio Bay', system: 'racefacer', url: 'https://live.racefacer.com/circuittokiobay' },
    { name: 'Buckmore Park', system: 'alpha', url: 'https://results.alphatiming.co.uk/buckmore/live' },
    { name: 'Karting Genk', system: 'apex', url: 'https://www.apex-timing.com/live-timing/karting-genk/index.html' }
];
const TF_NOISE = /\b(karting|kart|karts|circuit|raceway|racing|track|speedway|park|centre|center|indoor|outdoor|the)\b/g;
const TF_SYSTEMS = {
    racefacer: { probe: slug => `https://live.racefacer.com/${slug}`, link: slug => `https://live.racefacer.com/${slug}` },
    apex: { probe: slug => `https://www.apex-timing.com/live-timing/${slug}/index.html`, link: slug => `https://www.apex-timing.com/live-timing/${slug}/index.html` }
};
const TF_SCOPES = {
    setup: { system: 'tfSystem', track: 'tfTrack', url: 'liveTimingUrl', status: 'liveTimingStatus', okClass: 'text-[11px] text-green-500 text-center', errClass: 'text-[11px] text-red-500 text-center' },
    race: { system: 'racetfSystem', track: 'racetfTrack', url: 'raceLtUrl', status: 'raceLtStatus', okClass: 'no-live-status is-ok', errClass: 'no-live-status is-error' }
};

Object.assign(window.translations.en, {
    tfSystem: 'Timing system', tfTrack: 'Track name...', tfFind: 'Find', tfSearching: 'Searching...',
    tfFound: 'Link found', tfNotFound: 'No link found - paste the URL below', tfNeedName: 'Enter the track name', tfNoProbe: 'Alpha links cannot be searched - paste the URL below'
});
if (window.translations.he) {
    Object.assign(window.translations.he, {
        tfSystem: 'מערכת תזמון', tfTrack: 'שם המסלול...', tfFind: 'חפש', tfSearching: 'מחפש...',
        tfFound: 'הקישור נמצא', tfNotFound: 'לא נמצא קישור - הדביקו את הכתובת למטה', tfNeedName: 'הזינו שם מסלול', tfNoProbe: 'קישורי Alpha לא ניתנים לחיפוש - הדביקו את הכתובת למטה'
    });
}

if (window.translations.el) {
    Object.assign(window.translations.el, {
        tfSystem: 'Σύστημα χρονομέτρησης', tfTrack: 'Όνομα πίστας...', tfFind: 'Αναζήτηση', tfSearching: 'Αναζήτηση...',
        tfFound: 'Βρέθηκε ο σύνδεσμος', tfNotFound: 'Δεν βρέθηκε σύνδεσμος - επικολλήστε τη διεύθυνση παρακάτω', tfNeedName: 'Εισάγετε το όνομα της πίστας', tfNoProbe: 'Οι σύνδεσμοι Alpha δεν αναζητούνται - επικολλήστε τη διεύθυνση παρακάτω'
    });
}

const tfNorm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function tfSavedTracks() {
    try { return JSON.parse(localStorage.getItem(TF_STORE_KEY) || '[]'); } catch (e) { return []; }
}

// Slugs a venue is likely to use: joined, hyphenated, underscored, each with and without generic words.
function tfCandidates(name) {
    const full = tfNorm(name);
    const core = full.replace(TF_NOISE, ' ').replace(/\s+/g, ' ').trim();
    const out = new Set();
    for (const base of [full, core]) {
        if (!base) continue;
        out.add(base.replace(/ /g, ''));
        out.add(base.replace(/ /g, '-'));
        out.add(base.replace(/ /g, '_'));
    }
    return [...out].filter(Boolean).slice(0, 6);
}

async function tfExists(url) {
    try {
        const res = await fetch('/.netlify/functions/cors-proxy?url=' + encodeURIComponent(url), { signal: AbortSignal.timeout(15000) });
        return res.status === 200;
    } catch (e) { return false; }
}

// Resolves to a URL, or null. `system` is 'racefacer' | 'apex' | 'alpha'.
window.resolveTrackUrl = async function(system, name) {
    const wanted = tfNorm(name);
    if (!wanted) return null;
    const known = [...tfSavedTracks(), ...TF_SEED].find(t => t.system === system && (tfNorm(t.name) === wanted || tfNorm(t.name).includes(wanted)));
    if (known) return known.url;
    const sys = TF_SYSTEMS[system];
    if (!sys) return null;
    for (const slug of tfCandidates(name)) {
        if (await tfExists(sys.probe(slug))) return sys.link(slug);
    }
    return null;
};

window.rememberTrack = function(name, system, url) {
    if (!name || !url) return;
    const kept = tfSavedTracks().filter(t => !(t.system === system && tfNorm(t.name) === tfNorm(name)));
    kept.unshift({ name: name.trim(), system, url });
    try { localStorage.setItem(TF_STORE_KEY, JSON.stringify(kept.slice(0, 50))); } catch (e) { /* storage full or blocked */ }
    window.refreshTrackList();
};

window.refreshTrackList = function() {
    const names = [...new Set([...tfSavedTracks(), ...TF_SEED].map(t => t.name))];
    const html = names.map(n => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
    const list = document.getElementById('tfTrackList');
    if (list) list.innerHTML = html;
};

// scope: 'setup' (race setup form) or 'race' (connect mid-race form)
window.findTrackUrl = async function(scope) {
    const ids = TF_SCOPES[scope] || TF_SCOPES.setup;
    const system = document.getElementById(ids.system).value;
    const name = document.getElementById(ids.track).value.trim();
    const status = document.getElementById(ids.status);
    const say = (key, ok) => { if (status) { status.textContent = window.t(key); status.className = ok ? ids.okClass : ids.errClass; } };
    if (!name) { say('tfNeedName', false); return; }
    if (status) { status.textContent = window.t('tfSearching'); status.className = ids.okClass; }
    const url = await window.resolveTrackUrl(system, name);
    if (!url) { say(system === 'alpha' ? 'tfNoProbe' : 'tfNotFound', false); return; }
    document.getElementById(ids.url).value = url;
    window.rememberTrack(name, system, url);
    say('tfFound', true);
};

document.addEventListener('DOMContentLoaded', window.refreshTrackList);
