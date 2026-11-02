// ==========================================
// Lap-target labels (race ends after N laps)
// Order: en, he, fr, pt, ru, ar, es, it, ka, de, ja, el
// ==========================================
(function () {
    const LANGS = ['en', 'he', 'fr', 'pt', 'ru', 'ar', 'es', 'it', 'ka', 'de', 'ja', 'el'];
    const X = {
        lblRaceTarget: ['Race ends after', 'המירוץ מסתיים אחרי', 'La course se termine après', 'A corrida termina após', 'Гонка заканчивается после', 'ينتهي السباق بعد', 'La carrera termina tras', 'La gara termina dopo', 'რბოლა მთავრდება', 'Rennen endet nach', 'レース終了条件', 'Ο αγώνας τελειώνει μετά από'],
        targetTime: ['Time', 'זמן', 'Durée', 'Tempo', 'Время', 'الوقت', 'Tiempo', 'Tempo', 'დრო', 'Zeit', '時間', 'Χρόνο'],
        targetLaps: ['Laps', 'הקפות', 'Tours', 'Voltas', 'Круги', 'لفات', 'Vueltas', 'Giri', 'წრეები', 'Runden', '周回数', 'Γύρους'],
        lblTotalLaps: ['Total laps', 'סה"כ הקפות', 'Nombre de tours', 'Total de voltas', 'Всего кругов', 'إجمالي اللفات', 'Vueltas totales', 'Giri totali', 'სულ წრეები', 'Gesamtrunden', '総周回数', 'Συνολικοί γύροι'],
        lblAvgLap: ['Average lap (sec)', 'הקפה ממוצעת (שניות)', 'Tour moyen (s)', 'Volta média (s)', 'Средний круг (с)', 'متوسط اللفة (ث)', 'Vuelta media (s)', 'Giro medio (s)', 'საშუალო წრე (წმ)', 'Ø Runde (s)', '平均ラップ (秒)', 'Μέσος γύρος (δλ)'],
        lapsShort: ['laps', 'הקפות', 'tours', 'voltas', 'кр.', 'لفات', 'vueltas', 'giri', 'წრე', 'Rdn.', '周', 'γύροι'],
        laps: ['laps', 'הקפות', 'tours', 'voltas', 'кругов', 'لفات', 'vueltas', 'giri', 'წრე', 'Runden', '周', 'γύροι'],
        xWzOffHint: ['Leave empty to turn off.', 'השאירו ריק לכיבוי.', 'Laissez vide pour désactiver.', 'Deixe vazio para desativar.', 'Оставьте пустым, чтобы отключить.', 'اتركه فارغًا للإيقاف.', 'Déjalo vacío para desactivar.', 'Lascia vuoto per disattivare.', 'დატოვეთ ცარიელი გამოსართავად.', 'Leer lassen zum Deaktivieren.', '空欄でオフになります。', 'Αφήστε κενό για απενεργοποίηση.']
    };
    LANGS.forEach((lang, i) => {
        const dict = (window.translations = window.translations || {})[lang] || (window.translations[lang] = {});
        Object.keys(X).forEach(k => { if (!dict[k]) dict[k] = X[k][i]; });
    });
})();
