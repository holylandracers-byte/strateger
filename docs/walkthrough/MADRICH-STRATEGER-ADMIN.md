# מדריך מנהל — Strateger (מירוץ + מקצה דירוג)

**Admin Walkthrough — Race & Qualifying**

מדריך תפעולי לצוות אסטרטגיה במסלול. מבוסס על סימולציה חיה באתר  
**https://strateger.onrender.com**

**Document version:** 1.1 · **Languages:** עברית + English  
**Updated:** November 2026 (v1.0 tested July 2026) · **Devices:** Laptop (1440×900) · Tablet (768×1024) · Phone (390×844)

> **Screenshots:** `docs/walkthrough/screenshots/` — captured live from the app.  
> **הערה על צילומי המסך:** צילומי הסטאפ והמירוץ (§2–§13) צולמו ביולי 2026, לפני שדרוג הממשק. **הטקסט כאן מעודכן**; אם צילום נראה אחרת — הטקסט הוא הקובע. צילומי **מראה / ערכות נושא** (§14) צולמו בנובמבר 2026.  
> *Setup and race screenshots (§2–§13) are from July 2026 and predate the UI overhaul — the text is current; where a screenshot differs, trust the text. Appearance screenshots (§14) are from November 2026.*

---

## איפה המדריך? / Where Is This Guide?

| איך לפתוח | How to open |
|---|---|
| **בפרויקט (Cursor / VS Code)** | Open file: `strateger/docs/walkthrough/MADRICH-STRATEGER-ADMIN.md` |
| **נתיב מלא** | `C:\Users\yanih\Music\MyProjects\strateger\docs\walkthrough\MADRICH-STRATEGER-ADMIN.md` |
| **צילומי מסך** | Same folder → `screenshots/` (21 PNG files) |
| **Preview** | In Cursor: open the `.md` file → **Markdown Preview** (Ctrl+Shift+V) to see images inline |
| **PDF / Word** | Export from preview, or use Pandoc / copy to Google Docs |

The guide is **already in your repo** — it is not on the website. The live app is at [strateger.onrender.com](https://strateger.onrender.com); this document is the admin manual for it.

---

## התחלה מהירה / Quick Start

| שלב | Step | EN | HE |
|-----|------|----|----|
| 1 | Open app | [strateger.onrender.com](https://strateger.onrender.com) — Home shows your saved strategies | דף הבית מציג אסטרטגיות שמורות |
| 2 | Choose language | 12 languages — pick on first launch or in the header menu | 12 שפות — בבחירה ראשונה או בתפריט |
| 3 | Pick a look | ☰ Menu → **Appearance** (§14) | ☰ תפריט ← **מראה** |
| 4 | New strategy | **+ New strategy** → one-page setup (accordion cards) | **+ אסטרטגיה חדשה** |
| 5 | Set race params | Duration (h:mm) or laps, stops, min/max stint, pit time | משך (ש:דק׳) או הקפות |
| 6 | Add drivers | Names + colors; the top driver is the starter | הנהג העליון = STARTER |
| 7 | Qualifying (optional) | Answer **Yes** to the qualifying question → **Start Qualifying** | תשובה **כן** בשאלת המקצה |
| 8 | Preview + start | **Preview and start** → check the plan → **START RACE** (asks to confirm) | **התחל מירוץ** (עם אישור) |
| 9 | During race | Tap **ENTER PIT** / **Exit Pits** at **real times** — not the plan | **כניסה לפיטס** / **יציאה מהפיט** לפי **זמן אמת** |
| 10 | After drift | Open **▶ PLAN** — remaining stints auto-adjust | **▶ תוכנית** — סטינטים שנותרו מתעדכנים |

---

## תוכן עניינים / Table of Contents

1. [סקירה כללית / Overview](#1-סקירה-כללית--overview)
2. [כניסה והגדרות / Access & Setup](#2-כניסה-והגדרות--access--setup)
3. [מקצה דירוג / Qualifying](#3-מקצה-דירוג--qualifying)
4. [תחילת מירוץ / Starting the Race](#4-תחילת-מירוץ--starting-the-race)
5. [לוח מחוונים חי / Live Race Dashboard](#5-לוח-מחוונים-חי--live-race-dashboard)
6. [פיטסטופ וחילוף נהג / Pit Stop & Driver Swap](#6-פיטסטופ-וחילוף-נהג--pit-stop--driver-swap)
7. [סטייה מהתוכנית — אסטרטגיה דינמית / Strategy Recalculation](#7-סטייה-מהתוכנית--אסטרטגיה-דינמית--strategy-recalculation)
8. [תרחישים אמיתיים / Real Race Scenarios](#8-תרחישים-אמיתיים--real-race-scenarios)
9. [סיום מירוץ / Race Finish](#9-סיום-מירוץ--race-finish)
10. [תצוגה לפי מכשיר / Responsive Layouts](#10-תצוגה-לפי-מכשיר--responsive-layouts)
11. [טיפים מהירים / Quick Reference](#11-טיפים-מהירים--quick-reference)
12. [תחזית אסטרטגיה + בלתי אפשרי / Strategy Outlook & IMPOSSIBLE](#12-תחזית-אסטרטגיה--בלתי-אפשרי--strategy-outlook--impossible)
13. [תזמון חי — הרבה קבוצות / Live Timing (Many Teams)](#13-תזמון-חי--הרבה-קבוצות--live-timing-many-teams)
14. [מראה וערכות נושא / Appearance & Themes](#14-מראה-וערכות-נושא--appearance--themes)
15. [מה השתנה מאז v1.0 / What Changed Since v1.0](#15-מה-השתנה-מאז-v10--what-changed-since-v10)

---

## 1. סקירה כללית / Overview

### מה Strateger עושה / What Strateger Does

| תפקיד / Role | עברית | English |
|---|---|---|
| **תכנון** | חישוב סטינטים, עצירות חובה, חלוקת זמן בין נהגים | Calculate stints, mandatory stops, driver time split |
| **מקצה דירוג** | ניהול Q1/Q2/Q3, ריצות לנהג, תוצאות | Manage Q1/Q2/Q3, runs per driver, results |
| **מירוץ חי** | טיימרים, כניסה לפיטס, חילוף נהג, PUSH/PROBLEM | Live timers, pit entry, driver swap, PUSH/PROBLEM |
| **התאמה דינמית** | עדכון אסטרטגיה לפי זמנים **בפועל** — לא רק לפי התוכנית | Recalculate strategy from **actual** timestamps, not just the plan |

### כתובת האתר / Site URL

```
https://strateger.onrender.com
```

> **הערה:** האפליקציה היא PWA — ניתן להוסיף למסך הבית בטאבלט/טלפון לגישה מהירה במסלול.  
> **Note:** The app is a PWA — add to home screen on tablet/phone for quick pit-lane access.  
> **עדכון:** אין יותר אפליקציית Android/iOS נפרדת — רק האתר + PWA. / *The Android/iOS wrapper was dropped: web + PWA only.*

### מכשיר מומלץ / Recommended Device

| מכשיר | שימוש | Device | Use |
|---|---|---|---|
| **טאבלט (768px)** | הכי נפוץ במסלול — מסך מלא, כפתורים גדולים | **Tablet** | Most common trackside — full layout, large buttons |
| **לפטופ** | תכנון לפני המירוץ + תצוגת אסטרטגיה | **Laptop** | Pre-race planning + strategy preview |
| **טלפון** | גיבוי / צוות קטן | **Phone** | Backup / small crew |

---

## 2. כניסה והגדרות / Access & Setup

### שלב 1 — פתיחת האפליקציה / Step 1 — Open the App

1. גלוש ל-**https://strateger.onrender.com**
2. בחר שפה — **12 שפות** (עברית, English, Français, Português, Русский, العربية, Español, Italiano, ქართული, Deutsch, 日本語, Ελληνικά). עברית וערבית מוצגות מימין לשמאל (RTL).
3. **דף הבית** מציג את האסטרטגיות השמורות שלך (כרטיס לכל אחת: משך, עצירות, נהגים, פס סטינטים צבעוני).
   *Home lists your saved strategies — one card each with duration, stops, drivers and a coloured stint bar.*

| כפתור בכרטיס | Button | מה עושה |
|---|---|---|
| **Preview and start** | תצוגה מקדימה והתחלה | פותח את התוכנית; משם מתחילים מירוץ |
| **Edit** | עריכה | חוזר להגדרות של אותה אסטרטגיה |
| **+ New strategy** | אסטרטגיה חדשה | מסך הגדרות ריק |
| **Start without a strategy** | להתחיל בלי אסטרטגיה | מירוץ מהיר |
| **Join as Driver** / **Race History** | הצטרף כנהג / היסטוריית מירוצים | |

> אם האפליקציה נסגרה באמצע מירוץ (טאבלט/טלפון נהרג ברקע) — כרטיס **Resume** מציע לחזור למירוץ וגם מציג **לפני כמה זמן נשמר**. המירוץ והסקוואדים נשמרים ב-localStorage ובכל שינוי נראות (visibilitychange) ובכל ~5 שניות.  
> *If the app is killed mid-race, a Resume card offers to continue and shows how long ago it was saved; race + squads are persisted every ~5 s and when the tab is hidden.*

### שלב 2 — מסך ההגדרות / Step 2 — The Setup Screen

ההגדרות הן **עמוד אחד, עמודה אחת**, ככרטיסים מתקפלים (accordion — **פתוח אחד בכל פעם**), עם **שורת Start מוצמדת** למטה. ל-Race / Qualifying אין יותר מתג נפרד: מקצה דירוג הוא **שאלה בתוך ההגדרות** (§3).  
*One page, one column, collapsible cards (one open at a time) with a pinned Start bar. The old Race Only / Qualifying + Race toggle is gone — qualifying is a question inside setup (§3).*

![Setup — Laptop EN](screenshots/01-laptop-setup-en.png)
*Laptop · July 2026 build — layout is now a single centred column*

![Setup — Laptop HE](screenshots/11-laptop-setup-he.png)
*Laptop · Hebrew (RTL) — section chevrons sit on the left, icons on the right*

### שלב 3 — הגדרות מירוץ / Step 3 — Race Settings

מלא את **General Info** לפי תקנון המירוץ:

| שדה | Field | דוגמה / Example | הסבר |
|---|---|---|---|
| Race target | יעד המירוץ | `Time` / `Laps` | מירוץ **לפי זמן** או **לפי הקפות** (מס׳ הקפות × זמן הקפה ממוצע קובע את אורך המירוץ; העצירות מוגדלות אם תקרת הסטינט דורשת) |
| Duration | משך | `3:00` | מוצג כ-**ש:דק׳** (לא עשרוני) |
| Required stops | עצירות חובה | `3` | וגם צ׳יפ **No required stops** |
| Min / Max Stint (min) | מינימום / מקסימום סטינט | `20` / `40` | שדה ריק = כבוי (**"empty = off"**, לא "0") |
| Pit Time (sec) | זמן פיט | `45–120` | שדה ריק = אין מינימום. צ׳יפ **Fast pits (no minimum)** מנקה את המינימום ומציג **זמן פיט טיפוסי** — משמש רק לתכנון, לא נאכף |
| Race Start Time / Date | שעה / תאריך | `19:00` | לתזמון ולוח שנה |

> **טיפ מהיר:** כפתורי **3h / 6h / 12h / 24h** לבחירה מהירה של משך המירוץ.  
> **תכנון:** התוכנית, התכנון מחדש והתיקון האוטומטי מכוונים **דקה אחת מתחת למקסימום** (max−1) כדי לא לעבור את התקרה בטעות.

**תיבת סיכום אוטומטית:** `4 Stints | Avg: 40.0m` ו-`Drive + Pit = Race length` — השורה מוצמדת מתחת לרשימה, בשעות, ובמירוץ הקפות גם עוקבת אחרי **הקפות מול היעד**.

#### חוקים וכללים / Rules & Advanced Constraints

| כלל | Rule | מה זה עושה |
|---|---|---|
| **Every driver drives** | כל נהג נוהג | מוסיף את העצירות הדרושות (N−1 ל-N נהגים פעילים) |
| **Sit-out** (לכל נהג) | הושבה | הנהג נשאר בקבוצה אך **מחוץ לתוכנית**; נשמר במאגר הנהגים |
| **Closed windows** | חלונות סגורים | חלון פיט סגור — עם **נתיב** in / out / both. חלון פתיחה/סיום נבדקים באותו מנגנון |
| **Direction change** | החלפת כיוון | לפי **שעה** או לפי **חצי מירוץ**, פיט in / out / both |
| **Add a rule** (Custom rules card) | כרטיס חוקים מותאמים | בסוף Advanced Constraints, מתקפל (ברירת מחדל: חצי מירוץ). חלונות שה-AI מצא עדיין מוצגים |
| **Compliance checker** | בדיקת עמידה בתקנון | מוצג בתצוגה המקדימה; תוכנית AI שמפרה יותר חוקים נדחית |

> *Rules proposal (AI)* — מציג משמעות כל כלל וציטוטים מהתקנון; שורות כפולות מנוקות.

### שלב 4 — נהגים / Step 4 — Drivers

1. הוסף נהגים מ**מאגר הנהגים** או הקלד שם חדש. שורת נהג **מינימלית** — שם + צבע; לחיצה על השורה פותחת **דיאלוג לנהג** (אזהרה, Sit-out וכו׳).
2. בחר **צבע** לכל נהג — שינוי צבע **נשמר במאגר**, והצבעים זהים בפס הסטינטים.
3. **הנהג העליון ברשימה = STARTER** (אין עוד סימון נפרד). שינוי סדר — דרך **ידית הגרירה (grip)**.
4. לחץ **Preview** / **Preview and start** לראות את התוכנית לפני המירוץ.

![Strategy preview — Laptop EN](screenshots/02-laptop-strategy-preview-en.png)
*Laptop · Strategy Preview — stint timeline before race start*

#### תצוגה מקדימה / The Preview

- **גרירת סטינטים:** בלחיצה על ה-**grip** בלבד (לא על השורה כולה). בטאבלט/מגע צריך **להחזיק 2 שניות** — כך נוגעים בשורה כדי לגלול. שורות קטנות יותר + פס גלילה.
- **טלפון:** שורות סטינט דחוסות בשתי שורות.
- במירוץ הקפות: הנהיגה מתפזרת **שווה** בין הסטינטים.
- **Start Race** מבקש **אישור** לפני התחלה. כשיש אזהרות תקנון — מופיע באנר בתצוגה.
- **שמירה:** הדיאלוג מציע **מכשיר / ענן**, ושומר עותק מקומי + מסנכרן לענן כשיש חיבור. **שמירה אוטומטית** אחרי ~15 שניות סרק, ומעדכנת את האסטרטגיה בעלת השם **במקום** (בלי עותקים כפולים).
- **ייצוא:** תמונה/PDF כדף דוח נקי עם מעברי עמוד.

### תצוגה לפי מכשיר — Setup / Responsive — Setup

| Laptop (1440×900) | Tablet (768×1024) | Phone (390×844) |
|---|---|---|
| עמודה אחת ממורכזת + שורת Start מוצמדת | אותו דבר, כפתורים גדולים | עמודה אחת, גלילה |
| ![Laptop setup](screenshots/01-laptop-setup-en.png) | ![Tablet setup](screenshots/17-tablet-setup-en.png) | ![Phone setup](screenshots/16-phone-setup-en.png) |

---

## 3. מקצה דירוג / Qualifying

### הגדרת מקצה / Qualifying Configuration

מקצה הדירוג הוא **עץ החלטות מתקדם** בתוך מסך ההגדרות: קודם שאלה **כן / לא**, ורק אם ענית **כן** נפתחים שלבי המשך (פורמט → נהגים → משך → כלל פיט) כאריחי אייקונים. חזרה ל-**לא** מסתירה את העץ. משך מקצה **ריק = כבוי**. יחידות ותצוגה מקדימה מתורגמות לשפה הנבחרת.  
*Qualifying is a progressive decision tree: Yes/No first, then format, drivers, duration, pit rule. Back to No hides it; empty duration = off.*

הגדר:

| הגדרה | Setting | אפשרויות / Options |
|---|---|---|
| Format | פורמט | Simple · Q1/Q2/Q3 |
| Segments | שלבים | Q1 · Q1+Q2 · Q1+Q2+Q3 |
| Duration (min) | משך (דק') | למשל `15` |
| Driver Participation | השתתפות | One · Multiple · All |
| Runs per driver | ריצות לנהג | `1`, `2`, … |
| Pit Stop Rule | כלל פיט | None · Any stop · Min time |

![Qualifying setup](screenshots/02-laptop-setup-qualifying-en.png)

**תיבת סיכום:**  
`2 driver(s) × 1 run(s) = 2 total · 7:30/run · Q1 → Q2 → Q3 · No pit required`

### הרצת מקצה / Running Qualifying

1. לחץ **Start Qualifying** / **התחל מקצה דירוג**
2. מסך המקצה מציג:
   - **QUALIFYING Q1** + טיימר ספירה לאחור
   - **CURRENT** — הנהג הנוכחי + RUN X/Y
   - **UP NEXT** — הנהג הבא
   - **RESULTS** — ריצות שנרשמו
   - **ENTER PIT** — אם נדרש פיט במקצה
   - **Next Run** — מעבר לריצה הבאה / נהג הבא

![Qualifying live Q1](screenshots/09-laptop-qualifying-live-en.png)

### רישום ריצה / Logging a Run

1. הנהג יוצא למסלול — הטיימר רץ
2. בסיום הריצה לחץ **Next Run**
3. התוצאה נרשמת ב-**RESULTS** (זמן, נהג, דירוג)
4. חזור על כל הנהגים → **Q2** → **Q3** (לפי ההגדרה)

![Qualifying results logged](screenshots/10-laptop-qualifying-results-en.png)

> **תרחיש אמיתי:** במקצה עם פיט חובה — לחץ **ENTER PIT** לפני יציאה מהפיט, ואז **Exit Pits** כשהנהג חוזר למסלול.

---

## 4. תחילת מירוץ / Starting the Race

1. לאחר הגדרות + נהגים → **Preview and start** (תצוגה מקדימה לפני התחלה)
2. לחץ **START RACE** / **התחל מירוץ** ואשר בחלון האישור
3. המסך עובר ל**לוח מחוונים חי**

**מה קורה ברקע:**  
האפליקציה שומרת `startTime`, `stintStart`, ו-`stintTargets[]` — מערך יעדי סטינט לכל סטינט שנותר.

---

## 5. לוח מחוונים חי / Live Race Dashboard

### אלמנטים מרכזיים / Key Elements

| אלמנט | Element | תיאור / Description |
|---|---|---|
| **RACE TIME** | זמן מירוץ | זמן שנותר / elapsed |
| **STOPS** | עצירות | `1/3` — פיטס שבוצעו / נדרשים |
| **STATUS** | מצב | On Track / IN PIT |
| **TARGET STINT** | יעד סטינט | זמן יעד לסטינט הנוכחי + סטייה (+/-) |
| **CURRENT** | נוכחי | הנהג במסלול + זמן סטינט |
| **STRATEGY OUTLOOK** | תחזית אסטרטגיה | תוכנית שנותרה (סטינטים, MAX, זמן) |
| **STRATEGY OUTLOOK** | תחזית אסטרטגיה | **הפANEL החי** — משתנה אחרי כל פיט / סטינט (ראה §12) |
| **▶ PLAN** | תוכנית | תצוגת timeline מלאה (סטינטים שבוצעו + שנותרו) |
| **🔥 PUSH** | קצב | מצב דחיפה — מקצר יעד סטינט |
| **🐢 PROBLEM** | תקלה | מצב תקלה — מאריך יעד סטינט |
| **ENTER PIT** | כניסה לפיטס | כפתור ראשי — כניסה לפיט |
| **Phase steps** | שלבי מירוץ | רצועת שלבים + סלוט ל"הפעולה הבאה" |
| **🌧 Rain / Dry** | גשם / יבש | החלפת תוכנית לגשם/יבש |
| **💬 Chat** | צ׳אט | אייקון בכותרת עם תג הודעות שלא נקראו |
| **Pace** | קצב | PUSH / PROBLEM (ראה למטה) — עם הסבר בלחיצה |

![Race dashboard — English laptop](screenshots/03-laptop-race-dashboard-en.png)
*Laptop · English · Live race dashboard at race start*

![Race dashboard — Hebrew laptop](screenshots/12-laptop-race-dashboard-he.png)
*Laptop · Hebrew (RTL) · Live race dashboard*

> **עדכוני מסך מירוץ:** בטלפון/טאבלט **לאורך (portrait)** שעון הסטינט ראשון, כפתור הפיט **מוצמד** למטה, וסרגל תזמון חי מסודר. בטאבלט — שש אריחי סטטיסטיקה בשורה אחת. הנקודה האדומה הכפולה של LIVE הוסתרה (תזמון חי כבר מציג LIVE).

### מצבי PUSH / PROBLEM

| מצב | Mode | מתי / When | השפעה / Effect |
|---|---|---|---|
| **PLAN** | תוכנית | רגיל | יעד לפי `stintTargets` |
| **PUSH** | קצב | מסלול פנוי, רוצים לדחוף | יעד סטינט קצר יותר |
| **PROBLEM** | תקלה | תקלה, פקק, גשם | יעד סטינט ארוך יותר |

---

## 6. פיטסטופ וחילוף נהג / Pit Stop & Driver Swap

### תהליך פיטסטופ / Pit Stop Flow

```
On Track  →  ENTER PIT  →  IN PIT (timer)  →  Exit Pits  →  Next driver On Track
```

#### שלב 1 — כניסה לפיט / Enter Pit

1. לחץ **ENTER PIT** / **כניסה לפיטס**
2. אם הסטינט **קצר מדי** (< Min Stint) — מופיעה אזהרה:

![Short stint warning](screenshots/07-laptop-short-stint-warning-en.png)

> **⚠️ SHORT STINT! Penalty Risk**  
> Missing: 1015s · Proceed to Pit?  
> **Cancel** = המשך במסלול · **Confirm** = כניסה לפיט בכל זאת

#### שלב 2 — בפיט / In Pit

- מסך **IN PIT** עם טיימר פיט
- **Next [Driver Name]** — הנהג שיוצא
- **Exit Pits** — יציאה מהפיט
- **EXIT OVERDUE** — אם הפיט ארוך מהמתוכנן

![Pit stop in progress](screenshots/05-laptop-pit-stop-en.png)

> **בחירת הנהג הבא:** בטאבלט — לחיצה על נהג **מחליפה** את הנהג הבא, וה**תוכנית נכתבת מחדש** בהתאם. התאמת זמן הפיט היא בשני כפתורים (פחות/יותר) עם **גודל צעד** לבחירה.  
> **Exit Pits במכשירים איטיים:** הכפתור מגיב גם בשחרור המצביע (עם debounce), כך שלחיצה לא הולכת לאיבוד כשהדף מצייר מחדש. אם **תזמון חי** חוסם יציאה ידנית — מופיעה הודעה, ו**לחיצה שנייה תוך 4 שניות כופה** את היציאה — הנהג אף פעם לא נתקע במסך הפיט.  
> **אזהרת כניסה לפיט** נספרת לאחור מהסטינט המתוכנן (in-lap אופציונלי, עובד גם בלי max stint).

#### שלב 3 — יציאה מהפיט / Exit Pit

1. לחץ **Exit Pits**
2. הנהג הבא נכנס לסטינט
3. האפליקציה:
   - רושמת את הסטינט שהושלם (נהג + **משך בפועל**)
   - מפעילה `_recalcOnPitExit()` אם הסטייה > 3 דק'
   - מעדכנת `stintTargets` לסטינטים שנותרו

---

## 7. סטייה מהתוכנית — אסטרטגיה דינמית / Strategy Recalculation

> **עקרון מרכזי:** Strateger **לא** מכריח אותך לעקוב בדיוק אחרי התוכנית.  
> הוא **מתאים את התוכנית** לפי מה שקרה בפועל, תוך שמירה על:
> - משך המירוץ הכולל
> - Min/Max Stint
> - מספר עצירות חובה
> - חלוקה שוויונית בין נהגים (ככל האפשר)

### Key Principle

Strateger does **not** force you to follow the plan exactly.  
It **adapts the remaining plan** based on actual timestamps while respecting race parameters.

> **סטינטים שכבר נוהגו ננעלים:** אחרי כל פיט התוכנית של **הסטינטים שנותרו** מחושבת מחדש; אם תקרת הסטינט דורשת — **נוספת עצירה**. ה-NOW pill צבוע לפי max / min / regular כמו העתידיים, וסטינטים קרובים ל-max/min מקובצים עם משכיהם **האמיתיים**.

### איך זה עובד / How It Works

| מנגנון | Mechanism | מתי מופעל / Trigger |
|---|---|---|
| `_maybeRecalcAfterDrift()` | בדיקה כל ~15 שנ' | סטינט חורג > **6 דק'** מהתוכנית |
| `_recalcOnPitExit()` | ביציאה מפיט | סטינט שהושלם חורג > **3 דק'** |
| `_syncPreviewWithActuals()` | עדכון תצוגה | אחרי כל סטינט שהושלם |
| `recalculateTargetStint()` | יעד סטינט נוכחי | PUSH / PROBLEM / PLAN |

### דוגמה מסimulציה — סטינט ארוך מדי / Simulated Example — Stint Overrun

**תרחיש:** מירוץ 3 שעות, 2 נהגים, 3 עצירות, סטינט 20–40 דק'.

| | תוכנית מקורית | בפועל | אחרי התאמה |
|---|---|---|---|
| **Stint 1** (Alon Cohen) | 40 min | **62 min** ⚠️ | 62 min (ננעל) |
| **Stint 2** (Maya Levi) | 40 min | — | **39 min** |
| **Stint 3** (Alon Cohen) | 40 min | — | **39 min** |
| **Stint 4** (Maya Levi) | 40 min | — | **39 min** |

**מה קרה:**
1. Alon נשאר 22 דק' יותר מהמתוכנן (62 vs 40)
2. המערכת זיהתה drift > 6 דק' → `_maybeRecalcAfterDrift()`
3. הזמן שנותר (≈118 min) חולק ל-3 סטינטים × ~39 min (מקסימום 40)
4. ב-**▶ PLAN** — Stint 1 מוצג כ-**62m (locked/disabled)**, Stints 2–4 מעודכנים

![Race dashboard — stint overrun detected](screenshots/04-laptop-race-drift-en.png)
*TARGET STINT shows +0:09 (or more) — driver exceeded planned stint*

![Recalculated plan after drift](screenshots/06-laptop-plan-recalculated-en.png)

```
Stint Summary (after recalc):
  Alon Cohen  1:41:04  2× stints
  Maya Levi   1:17:42  2× stints

Timeline:
  #1  Alon Cohen   07:42 → 08:44   62m  ✓ actual
  #2  Maya Levi    08:44 → 09:23   39m
  #3  Alon Cohen   09:24 → 10:03   39m
  #4  Maya Levi    10:04 → 10:43   39m  🏁
```

> **מסר לצוות:** אם הגעתם לפיט 10 דק' מוקדם/מאוחר — **אל תדאגו**.  
> לחצו ENTER PIT / Exit Pits בזמן האמת. האפליקציה תעדכן את שאר המירוץ.

---

## 8. תרחישים אמיתיים / Real Race Scenarios

### תרחיש A — סטינט ארוך (Safety Car / פקק) / Long Stint

| שלב | פעולה / Action |
|---|---|
| 1 | הנהג נשאר במסלול יותר מהמתוכנן |
| 2 | **STRATEGY OUTLOOK** מתעדכן (למשל: `2× MAX (40m) + 15m`) |
| 3 | TARGET STINT מראה סטייה שלילית (אדום) |
| 4 | בפיט — Exit Pits → recalc אוטומטי |
| 5 | ▶ PLAN — בדוק שהסטינטים הבאים מעודכנים |

### תרחיש B — פיט מוקדם (תקלה) / Early Pit

| שלב | פעולה / Action |
|---|---|
| 1 | ENTER PIT לפני Min Stint |
| 2 | ⚠️ **SHORT STINT! Penalty Risk** — Missing: XXXs |
| 3 | **Confirm** = ממשיכים (יודעים שיש סיכון לעונש) |
| 4 | **Cancel** = חוזרים למסלול |
| 5 | אחרי Confirm — recalc מפזר זמן על הסטינטים שנותרו |

### תרחיש C — פיט ארוך (EXIT OVERDUE) / Slow Pit Stop

| שלב | פעולה / Action |
|---|---|
| 1 | IN PIT — טיימר רץ |
| 2 | 🚨 **EXIT OVERDUE** — הפיט ארוך מהמתוכנן |
| 3 | Exit Pits ברגע שהנהג יוצא |
| 4 | זמן הפיט נרשם בפועל → משפיע על התוכנית |

### תרחיש D — PUSH / PROBLEM במסלול

| מצב | מתי | פעולה |
|---|---|---|
| **🔥 PUSH** | מסלול פנוי, רוצים לרוץ מהר | לחץ PUSH → יעד סטינט קצר |
| **🐢 PROBLEM** | גשם, תאונה, עייפות | לחץ PROBLEM → יעד סטינט ארוך |
| **▶ PLAN** | חזרה לרגיל | לחץ PLAN |

### תרחיש E — עונש זמן / Time Penalty

כפתורי **-5 / +5 / +10 / +0s** בתחתית המסך — הוספת/הורדת שניות מהמירוץ (לפי החלטת שופטים).

---

## 9. סיום מירוץ / Race Finish

כש**RACE TIME** מגיע ל-**FINISH**:

1. מופיע מסך **RACE FINISHED**
2. סיכום: Duration · Stints · Pit Time · Start
3. דירוג נהגים לפי זמן כולל + אחוז מהמירוץ
4. לוג פיטסטופים (נהג, זמן נהיגה, זמן פיט)
5. **Share** / **Close**

![Race finished summary](screenshots/08-laptop-race-finished-en.png)

> **CONFIRM RACE FINISH** — אישור סיום המירוץ (נדרש לפני סגירה סופית).

---

## 10. תצוגה לפי מכשיר / Responsive Layouts

### Laptop (1440×900) — תכנון + מירוץ

- 2 עמודות: הגדרות | נהגים + פעולות
- לוח מירוץ: פאנל שמאל (טיימרים) + פאנל ימין (אסטרטגיה, PUSH/PROBLEM)
- תצוגת PLAN: timeline מלא + Start Race

### Tablet (768×1024) — **הכי נפוץ במסלול**

- כרטיסים ברוחב מלא, כפתורים גדולים
- ENTER PIT / Next Run בולטים
- RTL מלא בעברית
- מומלץ: landscape לתצוגת מירוץ, portrait להגדרות

![Tablet race dashboard HE](screenshots/13-tablet-race-dashboard-he.png)

### Phone (390×844) — גיבוי

- עמודה אחת, גלילה
- טיימרים + נהג נוכחי בראש
- ENTER PIT בתחתית (גלול למטה)
- PUSH / PROBLEM כפתורים גדולים

![Phone race dashboard HE — top](screenshots/14-phone-race-dashboard-he.png)
![Phone pit button visible — scroll down](screenshots/15-phone-race-dashboard-pit-he.png)

### השוואה מהירה / Quick Comparison

| תכונה | Laptop | Tablet | Phone |
|---|---|---|---|
| Setup 2-column | ✅ | ✅ (narrow) | ❌ (stacked) |
| Live timers | ✅ | ✅ | ✅ |
| ENTER PIT visible | ✅ | ✅ | ✅ (scroll) |
| PLAN timeline | ✅ full | ✅ scroll | ⚠️ compact |
| Hebrew RTL | ✅ | ✅ | ✅ |
| Appearance picker | חלון ממורכז, 6 עמודות | חלון ממורכז, 6 עמודות | **גיליון תחתון**, 3 עמודות |
| Recommended use | Planning | **Trackside** | Backup |

---

## 11. טיפים מהירים / Quick Reference

### לפני המירוץ / Before the Race

- [ ] שם קבוצה + נהגים + STARTER
- [ ] Duration, Req. Stops, Min/Max Stint, Pit Time
- [ ] Preview Strategy — וודא 4 stints, זמנים הגיוניים
- [ ] בחר שפה (HE/EN) לפי הצוות
- [ ] הוסף ל-Home Screen (PWA) בטאבלט

### במהלך המירוץ / During the Race

- [ ] ENTER PIT **בזמן האמת** — לא לפי התוכנית
- [ ] Exit Pits כשהנהג יוצא
- [ ] בדוק ▶ PLAN אחרי סטינט חריג
- [ ] SHORT STINT warning = החלטה מודעת (Confirm/Cancel)
- [ ] PUSH/PROBLEM לפי מצב מסלול

### אחרי סטינט חריג / After a Drift

1. ▶ PLAN → Stint 1 (actual, locked) + remaining stints updated
2. STRATEGY OUTLOOK → `Nx MAX (40m) + Xm`
3. TARGET STINT → delta (+/-) from plan
4. **אל תערוך ידנית** — המערכת מחשבת מחדש

### קיצורי דרך / Shortcuts

| פעולה | Action | EN | HE |
|---|---|---|---|
| כניסה לפיט | Pit entry | ENTER PIT | כניסה לפיטס |
| יציאה | Exit | Exit Pits | יציאה מהפיט |
| תוכנית | Plan view | ▶ PLAN | ▶ תוכנית |
| דחיפה | Push mode | 🔥 PUSH | 🔥 קצב |
| תקלה | Problem | 🐢 PROBLEM | 🐢 תקלה |
| ריצה הבאה (Q) | Next run | Next Run | ריצה הבאה |

---

## נספח — פרמטרים לדוגמה / Appendix — Example Config

**מירוץ סיבולת 3 שעות, 2 נהגים (Endurance Karting):**

```
Duration:     3 hours
Req. Stops:   3
Min Stint:    20 min
Max Stint:    40 min
Pit Time:     45 sec
Drivers:      Alon Cohen (STARTER), Maya Levi
Expected:     4 stints · ~40 min each · 3 pit stops
```

**מקצה דירוג Q1+Q2+Q3:**

```
Format:       Q1/Q2/Q3
Segments:     Q1+Q2+Q3
Duration:     15 min total
Drivers:      All (2)
Runs/driver:  1
Pit Rule:     None
Per run:      ~7:30
```

---

## 12. תחזית אסטרטגיה + בלתי אפשרי / Strategy Outlook & IMPOSSIBLE

> **זה החלק הכי חשוב במירוץ:** איך **לראות** שהאסטרטגיה השתנתה, ומתי המערכת אומרת ש**כבר לא ניתן** לעמוד בתקנון.

### איפה מסתכלים / Where to Look

During the race, on the **right column** (or below timers on tablet/phone):

```
┌─────────────────────────────────────┐
│  STRATEGY OUTLOOK          ▶ PLAN 02:58:30 │
│  ┌────────┐ ┌────────┐ ┌──────────┐   │
│  │ 2× MAX │ │ NORM 39m│ │ +14m buf │   │  ← remStintsText (pills)
│  └────────┘ └────────┘ └──────────┘   │
│  [ 🔥 PUSH ]  [ 🐢 PROBLEM ]         │
└─────────────────────────────────────┘
```

| אלמנט | Element | מה זה אומר |
|---|---|---|
| **שורת pills** (`remStintsText`) | Stint pills | תוכנית **מעודכנת** לסטינטים **שנותרו** (לא התוכנית המקורית) |
| **זמן** (`remTimeText`) | Race time left | זמן מירוץ שנותר |
| **▶ PLAN** | Full timeline | פותח timeline — סטינטים שבוצעו (ננעלים) + עתידיים |

### מתי האסטרטגיה מתעדכנת / When It Updates

| אירוע | Event | מה משתנה |
|---|---|---|
| כל ~15 שנ' במסלול | Every ~15s on track | `_maybeRecalcAfterDrift()` אם סטינט חורג > 6 דק' |
| **Exit Pits** | Pit exit | `_recalcOnPitExit()` — סטינט שהושלם נרשם, יעדים עתידיים מתעדכנים |
| **ENTER PIT** (מוקדם) | Early pit | recalc — זמן שנותר מחולק מחדש על הסטינטים שנשארו |
| **PUSH / PROBLEM** | Mode change | יעד הסטינט **הנוכחי** משתנה (לא בהכרח כל התוכנית) |

**אחרי כל פיט** — בדוק:
1. **STRATEGY OUTLOOK** — האם ה-pills השתנו? (למשל `2× MAX (40m)` → `3× NORM 35m`)
2. **▶ PLAN** — סטינט שבוצע = locked; שאר הסטינטים = timestamps חדשים

![Race dashboard after stint drift](screenshots/04-laptop-race-drift-en.png)

### pill-ים — מה כל צבע אומר / Pill Meanings

| Pill | עברית | משמעות |
|---|---|---|
| `2× MAX (40m)` | 2× מקסימום | שני סטינטים באורך מקסימום |
| `NORM 39m` | נורמלי 39 דק' | סטינט בינוני (בין min–max) |
| `MIN (20m)` | מינימום | סטינט קצר — קרוב לרצפה |
| **`IMPOSSIBLE −12m`** | **בלתי אפשרי −12 דק'** | **לא ניתן לסיים את המירוץ בתקנון** — חסר 12 דק' גם אם כל הסטינטים שנותרו = Min Stint |
| **`ADD STOP +14m`** | **הוסף עצירה +14 דק'** | יש **יותר מדי** זמן — צריך עצירה נוספת (או סטינטים ארוכים יותר) |
| `FINAL LAP` | הקפה אחרונה | אין עוד סטינטים — סיום מירוץ |

### IMPOSSIBLE — מתי זה קורה / When IMPOSSIBLE Appears

The app calculates **after each actual stop**:

```
futurePool = raceTimeLeft − currentStintRemaining − (futurePits × pitTime)
minRequired = futureStints × MinStint

if minRequired > futurePool  →  IMPOSSIBLE −Xm
```

**Real examples that trigger IMPOSSIBLE:**

| תרחיש | Scenario |
|---|---|
| סטינט ארוך מדי + פחות זמן לסטינטים שנותרו | Long stint → not enough time left for min-length stints |
| פיט מוקדם (short stint) + עוד 2 עצירות חובה | Early pit → remaining stints can't all reach Min Stint |
| עונש זמן / Safety Car ארוך | Time penalty ate the buffer |

**What to do when you see IMPOSSIBLE:**

1. **Do not panic** — the app still tracks actual times; you can finish the race.
2. Open **▶ PLAN** — see exact remaining stint targets.
3. **Decision:** accept penalty risk (short stints), push longer stints (over max = penalty), or add an extra stop if rules allow (`ADD STOP` hint).
4. Tell the team: original plan is **no longer achievable** within Min Stint × remaining stints.

![Short stint warning — early pit risk](screenshots/07-laptop-short-stint-warning-en.png)

### Setup vs Race — Invalid Strategy

| מסך | Screen | אזהרה |
|---|---|---|
| **Setup** (לפני מירוץ) | Before race | `Invalid Strategy: Average stint outside bounds` — **לא** להתחיל |
| **Race** (במהלך) | During race | `IMPOSSIBLE −Xm` in **STRATEGY OUTLOOK** — plan broke **after** actual events |

---

## 13. תזמון חי — הרבה קבוצות / Live Timing (Many Teams)

**Pro feature.** When the feed has 15–30+ teams, the UI must **not** cover strategy buttons.

### Layout — Dedicated Space (No Overlap)

Live timing is **not a floating popup**. It lives in its **own dock** at the top of the left column (`raceInfoPanel`):

```
┌─ raceInfoPanel (left, scrollable) ─────────┐
│  ┌─ LIVE TIMING (fixed height) ─────────┐ │
│  │  POS | LAP | LAST | BEST | GAP        │ │
│  │  ─────────────────────────────────    │ │
│  │  ▼ competitors table (scroll) ▼       │ │  ← only THIS scrolls
│  │  1  Team A  ...                       │ │
│  │  2  Team B  ...                       │ │
│  │  ... (20 teams)                       │ │
│  │  ═══ height handle (drag) ═══       │ │
│  └──────────────────────────────────────┘ │
│  ┌─ Current stint / progress bar ────────┐ │
│  ┌─ STRATEGY OUTLOOK ────────────────────┐ │  ← never hidden by timing
│  ┌─ ENTER PIT ──────────────────────────┐ │
└────────────────────────────────────────────┘
```

| כלל | Rule |
|---|---|
| **לא צף** | Widget is **docked** — does not float over ENTER PIT or OUTLOOK |
| **גלילה פנימית** | Competitors table scrolls **inside** the widget (`lt-table-scroll`) |
| **גובה מתכוונן** | On laptop (≥1024px): drag **height handle** at bottom of widget |
| **הסתר טבלה** | Toggle 📋/🗂️ to collapse competitors list — keep your POS/LAP only |
| **פילטר** | Setup: filter by **Team** / **Driver** / **Kart #** — show only your row |

### Setup — Connect Live Timing

1. Expand **Live Timing** (🔒 PRO) on setup screen
2. Paste venue URL → **Test**
3. Filter: **Team** → enter your team name
4. Start race — widget appears at top of left panel when connected

### Tablet / Phone with Many Teams

| מכשיר | המלצה |
|---|---|
| **Tablet** | Increase widget height (handle) **or** collapse competitors table (📋) — keep strategy visible below |
| **Phone** | Prefer **filter to your team only** — one row, no long scroll |
| **All** | Drag panels in `raceInfoPanel` if needed — pit button stays pinned at bottom |

### עדכוני תזמון חי / Live Timing Updates

| יכולת | Feature | פרטים |
|---|---|---|
| **מתג תצוגה** | View switch | כפתור בכותרת מחליף בין **אריחים / דירוג / שניהם**; נזכר לכל מכשיר |
| **העמוד המקורי** | Original page view | זמין לכל הספקים; ממלא את כל הווידג׳ט (מסתיר אריחי סטטיסטיקה) |
| **איזו מכונית שלך** | Car filter | התאמה לפי **קבוצה / קארט / נהג / הצג הכול**, עם טקסט עזרה; **Team picker** לבחירה מהרשימה |
| **שעון** | Clock sync | שעון המירוץ עוקב אחרי שעון התזמון: סטיות קטנות מעגנות מחדש; פיד ארוך מאריך את המירוץ; הפרש של 10+ דק׳ לא מיושם. מתג ליד השעון |
| **גובה** | Resizable | ידית גובה בכל פריסה (גם טלפון) ונשמרת |
| **פאנל ריק** | Empty panel | "Not connected" ניתן להסתרה; צ׳יפ מחזיר |
| **עדכון מתצלום** | Photo update | עדכון מצב מתצלום של מסך התזמון (זיהוי הקבוצה שלך בתמונה) |

### Auto-Pit (Optional)

When live timing detects pit in/out, **Auto-Pit** can call ENTER PIT / Exit Pits for you.  
Always verify **STRATEGY OUTLOOK** after auto events — same recalc rules apply.

---

## 14. מראה וערכות נושא / Appearance & Themes

**ערכת הנושא צובעת את כל האפליקציה** — כותרת, כרטיסים, חלונות, תפריטים, כפתורים והדגשות — בכל המכשירים (טלפון, טאבלט, מחשב). לא רק את הרקע מאחור.  
*A theme recolours the whole app on every device — header, cards, dialogs, menus, buttons and highlights — not just the page background.*

### איך פותחים / How to Open

☰ **תפריט** ← **מראה** (**Appearance**, אייקון 🎨). Esc, ✕, לחיצה על הרקע או **Close** סוגרים.

### מה בחלון / What's in the Panel

| אזור | Area | תיאור |
|---|---|---|
| **תצוגה מקדימה חיה** | Live preview | אפליקציה מוקטנת בצבעי הערכה. במחשב — **מעבר עכבר** (או מקש Tab) על ערכה מציג אותה **בלי להחיל**; לחיצה מחילה |
| **מסנן קבוצות** | Group chips | **All · Classic · Dark tones · Vivid · Photo** |
| **רשת ערכות** | Theme grid | כל ריבוע מציג את הרקע + **פס בצבע הפאנל** + **נקודת הדגשה** — רואים את צבעי הממשק, לא רק את הרקע |
| **Lite mode** | מצב קל | Auto / On / Off — פחות אנימציות ואפקטים, מועיל בטאבלטים איטיים |
| **Custom photo** | תמונה אישית | העלאת תמונה משלך (JPG/PNG/WebP עד 5MB) — **Pro** |
| **Reset to default** | איפוס | חזרה לערכה הרגילה |

### 40 ערכות / The 40 Themes

| קבוצה | Group | ערכות |
|---|---|---|
| **Classic** (6) | קלאסי | Default · Pure Black · Carbon · Tarmac · Flag · Pit Lane |
| **Dark tones** (14) | גוונים כהים | Night · Midnight · Deep Red · Forest · Purple · Pink · Amber · Sunset · Racing Red · Martini · Ferrari · Papaya · Volcanic · Neon |
| **Vivid** (12) | עזים | Ice · Teal · Bronze · Toxic · Royal · Blood Moon · Solar · Lightning · Cyan · Magenta · Chrome · Jade |
| **Photo** (8, **Pro**, דורש אינטרנט) | תמונה | Race · Night Race · Pit Stop · Onboard · Wet Race · Starting Grid · Speed Blaze · Helmet |

כל השמות, הכותרות והטקסטים בחלון מתורגמים ל-**12 השפות**.

### מה בדיוק משתנה בצבע / What Actually Changes Colour

כל ערכה מגדירה **4 צבעים** — ראשי, פאנל, מסגרת, **הדגשה (accent)** — ומהם נגזר כל השאר:

| צבע | Token | משפיע על |
|---|---|---|
| **ראשי** | `--n950` / `navy-950` | רקע המסכים (הגדרות, מירוץ, תצוגה מקדימה, מודאלים) |
| **פאנל** | `--n900` / `navy-900` | כותרת, כרטיסים, שורת המידע, חלונות, תפריטים |
| **משני** | `--n800`, `--n700` | משטחים מוגבהים, מצב hover, כפתורים משניים (נגזר מפאנל + מסגרת) |
| **מסגרת** | `--g600/700/800` | גבולות וקווי הפרדה בכל האפליקציה |
| **הדגשה** | `--accent-rgb` / `ice` | כפתורי פעולה, טאב פעיל, פוקוס, קישורים, ריבוע נבחר |

עוד: צבע שורת הדפדפן בטלפון (`theme-color`) עוקב אחרי הפאנל; ערכות Photo ו-Custom photo משתמשות בפאלטה **כמעט שחורה** כדי שהטקסט יישאר קריא על כל תמונה.

### בכל סוג מסך / On Each Device

| | **טלפון / Phone** | **טאבלט / Tablet** | **מחשב / Desktop** |
|---|---|---|---|
| **החלון** | **גיליון תחתון** (bottom sheet) עם ידית, עד 92% גובה | כרטיס ממורכז | כרטיס ממורכז רחב יותר (עד 780px) |
| **רשת** | 3 עמודות (4 מ-480px) | 6 עמודות | 6 עמודות |
| **אחרי בחירה** | נסגר אוטומטית כדי **לחשוף את התוצאה** | נשאר פתוח — אפשר להשוות | נשאר פתוח + תצוגה מקדימה במעבר עכבר |
| **תצוגה מקדימה** | נמוכה (84px) | 150px | 150px (96px במסך נמוך) |
| **מגע** | כפתורים ≥ 40–44px | | |

![Appearance — Phone (Forest)](screenshots/24-phone-appearance-forest-en.jpg)
*Phone · bottom sheet · Forest theme*

![Home — Phone (Forest)](screenshots/25-phone-home-forest-en.jpg)
*Phone · the whole home screen follows the theme: header, cards, buttons and the accent colour*

![Appearance — Tablet (Ferrari)](screenshots/22-tablet-appearance-ferrari-en.jpg)
*Tablet · centred card · Ferrari theme*

![Appearance — Laptop (Pink)](screenshots/23-laptop-appearance-pink-en.jpg)
*Laptop · live preview + group chips · Pink theme*

### נשמר ונטען / Saved & Restored

- הבחירה נשמרת במכשיר (`strateger_bg`) ונטענת **לפני הציור הראשון** (בלי הבהוב) — לערכות צבע. ערכות Photo / Custom photo נטענות אחרי שסטטוס Pro ידוע; ללא Pro — חוזרים בשקט לברירת המחדל.
- ערכות Photo ללא Pro: הריבוע מסומן 🔒; לחיצה פותחת את חלון השדרוג.
- הערכה משפיעה גם על **מצב צפייה / נהג / צופה** באותו מכשיר.

### פתרון בעיות / Troubleshooting

| תסמין | פתרון |
|---|---|
| ערכת Photo לא נטענת | בדוק אינטרנט; הריבוע מציג רק את הפאלטה כשאין תמונה |
| אחרי עדכון הצבעים נראים ישנים | רענן קשיח; ה-Service Worker מתעדכן לגרסה חדשה (cache 64) |
| קשה לקרוא על ערכה עזה | בחר ערכה מ-**Classic / Dark tones**, או Photo (פאלטה כהה) |

---

## 15. מה השתנה מאז v1.0 / What Changed Since v1.0

סיכום שינויים מאז מדריך 1.0 (יולי 2026). פירוט במקומות הרלוונטיים למעלה.

| תחום | Area | שינוי |
|---|---|---|
| **דף הבית** | Home | אסטרטגיות שמורות כרטיסים, כרטיס Resume עם **Edit**, תאריכים ומחרוזות מתורגמים |
| **הגדרות** | Setup | עמוד אחד, עמודה אחת, accordion (פתוח אחד), שורת Start מוצמדת, הנהג העליון = STARTER; **אשף ההגדרה המודרך הוסר** |
| **מירוץ** | Race target | יעד **זמן או הקפות**; משך ב-ש:דק׳; שדות ריקים = כבוי; Fast pits; "No required stops" |
| **חוקים** | Rules | Every driver drives, Sit-out לנהג, חלונות סגורים עם נתיב, החלפת כיוון (שעה / חצי מירוץ), כרטיס חוקים מותאמים, בדיקת תקנון, הצעת חוקים מ-AI |
| **מקצה דירוג** | Qualifying | עץ החלטות עם כן/לא ואריחים |
| **תוכנית** | Planning | max−1, נעילת סטינטים שנוהגו, הוספת עצירה כשצריך, סיכום Outlook מקובץ, החלפת גשם/יבש |
| **תצוגה מקדימה** | Preview | גרירה דרך grip בלבד, שורות דחוסות, שורת סיכום מוצמדת, אישור התחלה, ייצוא דוח נקי |
| **שמירה** | Save | מכשיר/ענן, שמירה אוטומטית בעלת שם, **התאוששות מקריסה** (מירוץ + סקוואדים) |
| **סקוואדים** | Squads | שחזור אותיות/חלונות/שיבוץ אחרי טעינה; הגדרת **שינה מינימלית** והצעת חלון ("Suggest window") שמכסה את הלילה; שורת סקוואד רק במצב לילה |
| **שיתוף** | Delegate | **האצלה (co-admin):** קישורי הזמנה ללא הגבלה מתפריט ☰, הרשאות לכל הזמנה (פיט, זמן פיט, נהג הבא, קצב/סקוואדים, סיום, צ׳אט), נערכות בזמן אמת וניתנות לביטול; המארח מאמת כל פקודה |
| **צ׳אט** | Chat | כפתור בכותרת + תג, נפתח מעל ווידג׳ט התזמון |
| **תזמון חי** | Live timing | מתג תצוגה, עמוד מקורי לכל הספקים, בורר קבוצה, סנכרון שעון, עדכון מתצלום (§13) |
| **טאבלט** | Tablet | שש אריחים בשורה, ריווח צפוף, החלפת נהג הבא בלחיצה, תיקון Exit Pits |
| **חיפוש מיקום** | Location | שורה אחת לכל אתר, ערים/עיירות/מסלולים, איחוד תוצאות בתוך 1 ק״מ |
| **מראה** | Appearance | **עבודה מחדש מלאה** — 40 ערכות, הצבע משפיע על כל הממשק בכל מכשיר (§14) |
| **שפות** | Languages | כל טקסט חדש ב-**12 שפות**; ביקורת מלאה ליוונית |
| **פלטפורמה** | Platform | web + PWA בלבד (ללא עטיפת Android/iOS) |

---

*מדריך זה נוצר מסימולציה חיה ב-strateger.onrender.com · יולי 2026 · עודכן נובמבר 2026 (v1.1)*  
*This guide was created from live simulation at strateger.onrender.com · July 2026 · updated November 2026 (v1.1)*
