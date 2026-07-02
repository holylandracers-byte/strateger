const fs = require('fs');
const path = require('path').join(__dirname, '..', 'js', 'state.js');
let s = fs.readFileSync(path, 'utf8');

function stintBlock(lang) {
  const t = {
    it: { soon: 'Inizia ad avvisare il pilota tra', now: 'AVVISA PILOTA — Finestra ingresso box aperta', late: 'RISCHIO MAX STINT — Il pilota deve entrare ora', info: 'Avvisa da {{time}} (max {{max}}m − {{inlap}}s in-lap − {{lead}}m anticipo)', preview: '→ Avvisa pilota allo stint {{time}}', short: '✓ Avvisato' },
    de: { soon: 'Fahrer warnen in', now: 'FAHRER WARNEN — Boxeneinfahrt-Fenster offen', late: 'MAX-STINT-RISIKO — Fahrer muss jetzt boxen', info: 'Warnen ab {{time}} (max {{max}}m − {{inlap}}s In-lap − {{lead}}m Vorlauf)', preview: '→ Fahrer warnen ab Stint {{time}}', short: '✓ Gewarnt' },
    ja: { soon: 'ドライバーへの通知開始まで', now: 'ドライバーに通知 — ピット入口ウィンドウ開', late: '最大スティントリスク — 今すぐピットイン', info: '{{time}}から通知 (最大{{max}}分 − in-lap{{inlap}}秒 − {{lead}}分前)', preview: '→ スティント{{time}}でドライバーに通知', short: '✓ 通知済' },
    el: { soon: 'Ξεκινήστε ειδοποίηση οδηγού σε', now: 'ΕΙΔΟΠΟΙΗΣΤΕ ΟΔΗΓΟ — Ανοιχτό παράθυρο εισόδου pit', late: 'ΚΙΝΔΥΝΟΣ ΜΕΓ. STINT — Ο οδηγός πρέπει να μπει τώρα', info: 'Ειδοποίηση από {{time}} (μέγ {{max}}λ − {{inlap}}δ in-lap − {{lead}}λ πριν)', preview: '→ Ειδοποίηση οδηγού στο stint {{time}}', short: '✓ Ειδοποιήθηκε' },
  }[lang];
  return `, stintNotifySoon: "${t.soon}", stintNotifyNow: "${t.now}", stintNotifyLate: "${t.late}", stintNotifyInfo: "${t.info}", pitNotifyPreview: "${t.preview}", driverNotifiedShort: "${t.short}"`;
}

const replacements = [
  ['it', 'orangeZone: "⚠️ Zona arancione - solo NOTIFICA", targetLabel:', 'orangeZone: "⚠️ Zona arancione - solo NOTIFICA"' + stintBlock('it') + ', targetLabel:'],
  ['de', 'orangeZone: "⚠️ Orangezone - nur BENACHRICHTIGEN", targetLabel:', 'orangeZone: "⚠️ Orangezone - nur BENACHRICHTIGEN"' + stintBlock('de') + ', targetLabel:'],
  ['ja', 'orangeZone: "⚠️ オレンジゾーン - 通知のみ", targetLabel:', 'orangeZone: "⚠️ オレンジゾーン - 通知のみ"' + stintBlock('ja') + ', targetLabel:'],
  ['el', 'orangeZone: "⚠️ Πορτοκαλί ζώνη - μόνο ΕΙΔΟΠΟΙΗΣΗ",\r\n        targetLabel:', 'orangeZone: "⚠️ Πορτοκαλί ζώνη - μόνο ΕΙΔΟΠΟΙΗΣΗ"' + stintBlock('el') + ',\r\n        targetLabel:'],
];

for (const [lang, oldPart, newPart] of replacements) {
  if (!s.includes(oldPart)) {
    console.error('MISSING', lang);
    process.exit(1);
  }
  s = s.replace(oldPart, newPart);
  console.log('patched', lang);
}

fs.writeFileSync(path, s);
console.log('done');
