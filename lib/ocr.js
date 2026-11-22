/* ------------------------------------------------------------------
   OCR helper — Tesseract.js (browser me chalta hai, CDN se load hota hai)
   Koi API key / paisa nahi lagta.
------------------------------------------------------------------- */

let loading = null;

export async function loadTesseract() {
  if (typeof window === 'undefined') throw new Error('OCR sirf browser me chalta hai');
  if (window.Tesseract) return window.Tesseract;
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.async = true;
    s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract load fail')));
    s.onerror = () => reject(new Error('OCR library load nahi hui — internet check karein'));
    document.head.appendChild(s);
  });

  return loading;
}

/** image/file -> plain text */
export async function ocrImage(file, onProgress) {
  const T = await loadTesseract();
  const worker = await T.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/* ------------------------------------------------------------------
   ROLL NUMBER PARSING  (attendance sheet se)
   pattern example: "26-ARID-"  ->  26-ARID-4700
------------------------------------------------------------------- */
export function rollRegex(prefix) {
  const parts = String(prefix || '26-ARID-')
    .split('-')
    .filter(Boolean);
  const year = parts[0] || '26';
  const code = (parts[1] || 'ARID').toUpperCase();
  return new RegExp(`${year}\\s*[-–—]?\\s*${code}\\s*[-–—]?\\s*(\\d{2,6})`, 'gi');
}

/** Text me mile hue roll numbers (canonical form) ki list */
export function extractRolls(text, prefix = '26-ARID-') {
  const parts = String(prefix).split('-').filter(Boolean);
  const year = parts[0] || '26';
  const code = (parts[1] || 'ARID').toUpperCase();

  const found = new Set();
  const re = rollRegex(prefix);
  let m;
  const t = String(text || '').replace(/[–—]/g, '-');
  while ((m = re.exec(t)) !== null) {
    found.add(`${year}-${code}-${m[1]}`);
  }

  // Fallback: akela 4 digit number bhi match karo
  const nums = t.match(/\b\d{4}\b/g) || [];
  return { rolls: [...found], numbers: [...new Set(nums)] };
}

/** OCR text + students list -> Set of student ids jo present hain */
export function matchStudents(ocrText, students, prefix) {
  const { rolls, numbers } = extractRolls(ocrText, prefix);
  const present = new Set();

  const norm = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

  students.forEach((st) => {
    const roll = norm(st.roll_no);
    const tail = roll.split('-').pop();
    if (st.roll_no && rolls.some((r) => norm(r) === roll)) present.add(st.id);
    else if (tail && numbers.includes(tail)) present.add(st.id);
  });

  return { present, rolls, numbers };
}

/* ------------------------------------------------------------------
   TIMETABLE TEXT PARSING
   Line example: "Monday 08:30-09:50 Data Structures Room 12"
------------------------------------------------------------------- */
const DAY_WORDS = [
  ['monday', 'mon', 'peer', 'somwar'],
  ['tuesday', 'tue', 'tues', 'mangal'],
  ['wednesday', 'wed', 'budh'],
  ['thursday', 'thu', 'thur', 'jumerat'],
  ['friday', 'fri', 'jumma'],
  ['saturday', 'sat', 'hafta'],
];

export function parseTimetableText(text, subjects = []) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  let currentDay = null;

  lines.forEach((line) => {
    const low = line.toLowerCase();

    DAY_WORDS.forEach((words, idx) => {
      if (words.some((w) => low.includes(w))) currentDay = idx + 1;
    });
    if (!currentDay) return;

    const times = [...line.matchAll(/(\d{1,2})\s*[:.]\s*(\d{2})/g)].map(
      (m) => `${m[1].padStart(2, '0')}:${m[2]}`
    );

    let best = null;
    let bestScore = 0;
    subjects.forEach((s) => {
      const name = (s.name || '').toLowerCase();
      const code = (s.code || '').toLowerCase();
      let score = 0;
      const words = name.split(/\s+/).filter((w) => w.length > 3);
      words.forEach((w) => {
        if (low.includes(w.slice(0, 5))) score += 2;
      });
      if (code && low.includes(code)) score += 3;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    });

    const roomMatch = line.match(/(?:room|hall|lab)\s*[-:#]?\s*([A-Za-z0-9-]+)/i);

    if (best || times.length) {
      out.push({
        day: currentDay,
        subject_id: best?.id || '',
        label: best ? '' : line.replace(/\d{1,2}\s*[:.]\s*\d{2}/g, '').trim().slice(0, 40),
        start_time: times[0] || '',
        end_time: times[1] || '',
        room: roomMatch ? roomMatch[1] : '',
        raw: line,
      });
    }
  });

  return out;
}
