// Zeitstrahl und Zustände – Heidelberg School of Education
//
// Ergänzt die Seite um die eine Grafik (den Weg von der Anmeldung bis zum
// Ref-Start) und um die Leer-/Befundzustände. Nutzt die Funktionen aus
// script.js (fristen, lang, kurz, ampel, plusTage, ausEingabe, el) und ändert
// dort nichts: die gesamte Rechenlogik bleibt unberührt.

(() => {
  'use strict';

  const zeichenflaeche = document.getElementById('zeitstrahl');
  const legendeEl = document.getElementById('zeitstrahl-legende');
  const leerEl = document.getElementById('rechner-leer');
  const findingEl = document.getElementById('finding-datum');
  if (!zeichenflaeche) return;

  const NS = 'http://www.w3.org/2000/svg';
  const TAG_MS = 24 * 60 * 60 * 1000;

  // Die Abschnitte des Wegs. Nur der Bearbeitungsabschnitt trägt die eine
  // Datenfarbe – er ist das Hauptelement; alles andere bleibt neutral.
  const ABSCHNITTE = [
    { id: 'bearbeitung', name: 'Bearbeitung (17 Wochen)', fill: 'var(--chart)', ink: '#ffffff' },
    { id: 'kulanz',      name: 'Nur noch Bescheinigung',  fill: 'var(--warn-bg)', stroke: 'var(--warn)', dash: '3 3' },
    { id: 'pruefung',    name: 'Bewertung und Prüfungsamt', fill: 'var(--chart-track)' },
  ];

  function el_(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function zeichne() {
    const f = fristen(Number(el.refStart.value));

    const von = f.anmeldungGruen;
    const bis = f.rp;
    const spanne = (bis - von) / TAG_MS;

    // Die viewBox folgt der tatsaechlichen Breite, damit das SVG 1:1 skaliert
    // und die Beschriftung auf dem Handy nicht auf 4px zusammenschrumpft.
    const B = Math.max(300, Math.round(zeichenflaeche.getBoundingClientRect().width) || 1040);
    const eng = B < 560;               // Handy: Marken brauchen eine eigene Zeile
    const H = eng ? 150 : 132;
    const L = 6, R = B - 6;            // Rand
    const balkenY = eng ? 58 : 50, balkenH = eng ? 24 : 28;
    const x = (d) => L + ((d - von) / TAG_MS / spanne) * (R - L);

    zeichenflaeche.textContent = '';
    const svg = el_('svg', {
      viewBox: `0 0 ${B} ${H}`,
      role: 'img',
      'aria-label': `Zeitstrahl vom ${lang(von)} bis zum ${lang(bis)}: 17 Wochen Bearbeitung, dann Bewertung und Prüfungsamt bis zur Frist des Regierungspräsidiums.`,
    }, zeichenflaeche);

    // --- Abschnitte ---------------------------------------------------------
    const bearbeitungBis = f.abgabeGruen;

    // Bearbeitung: Anmeldung bis grüne Abgabefrist
    el_('rect', {
      x: x(von), y: balkenY, width: x(bearbeitungBis) - x(von), height: balkenH,
      rx: 3, fill: 'var(--chart)',
    }, svg);

    // Bewertung und Prüfungsamt: grüne Abgabefrist bis RP-Frist
    el_('rect', {
      x: x(bearbeitungBis), y: balkenY, width: x(bis) - x(bearbeitungBis), height: balkenH,
      rx: 3, fill: 'var(--chart-track)',
    }, svg);

    // Kulanzfenster: grüne bis gelbe Abgabefrist, als gestrichelter Rahmen darüber
    el_('rect', {
      x: x(bearbeitungBis), y: balkenY, width: Math.max(2, x(f.abgabeGelb) - x(bearbeitungBis)), height: balkenH,
      rx: 3, fill: 'var(--warn-bg)', stroke: 'var(--warn)', 'stroke-width': 1,
      'stroke-dasharray': '3 3',
    }, svg);

    // Beschriftung im Bearbeitungsbalken, wenn Platz ist
    const breiteBearb = x(bearbeitungBis) - x(von);
    if (breiteBearb > 150 && !eng) {
      const t = el_('text', {
        x: x(von) + breiteBearb / 2, y: balkenY + balkenH / 2 + 4,
        'text-anchor': 'middle', fill: '#ffffff', 'font-size': 12, 'font-weight': 500,
      }, svg);
      t.textContent = '17 Wochen Bearbeitungszeit';
    }

    // --- Marken -------------------------------------------------------------
    // Jede Marke: 1px-Linie, Datum darüber, Rolle darunter.
    const marken = [
      { d: von,           titel: 'Anmeldung', oben: true  },
      { d: f.abgabeGruen, titel: 'Abgabe',    oben: false },
      { d: bis,           titel: eng ? 'RP' : 'Unterlagen beim RP', oben: true },
    ];

    for (const m of marken) {
      const mx = x(m.d);
      el_('line', {
        x1: mx, y1: m.oben ? 32 : balkenY + balkenH,
        x2: mx, y2: m.oben ? balkenY : balkenY + balkenH + 11,
        stroke: 'var(--text)', 'stroke-width': 1,
      }, svg);

      const rand = eng ? 52 : 80;
      const anker = mx < rand ? 'start' : mx > B - rand ? 'end' : 'middle';
      const tx = mx < rand ? L : mx > B - rand ? R : mx;

      const datumT = el_('text', {
        x: tx, y: m.oben ? 26 : balkenY + balkenH + 27,
        'text-anchor': anker, fill: 'var(--text)',
        'font-size': eng ? 12 : 13, 'font-weight': 500,
        style: 'font-variant-numeric: tabular-nums',
      }, svg);
      datumT.textContent = kurz(m.d);   // kurz() liefert den Punkt bereits mit

      const rolleT = el_('text', {
        x: tx, y: m.oben ? 12 : balkenY + balkenH + 42,
        'text-anchor': anker, fill: 'var(--faint)', 'font-size': eng ? 11 : 12,
      }, svg);
      rolleT.textContent = m.titel;
    }

    // --- Eingetragenes Datum als Marke --------------------------------------
    const eingabe = ausEingabe(el.datum.value);
    if (eingabe) {
      const art = document.querySelector('input[name="art"]:checked').value;
      const abgabe = art === 'anmeldung' ? plusTage(eingabe, 7 * 17) : eingabe;
      const farbe = ampel(abgabe, f);
      const hue = farbe === 'gruen' ? 'var(--pos)' : farbe === 'gelb' ? 'var(--warn)' : 'var(--neg)';
      const mx = Math.min(R, Math.max(L, x(abgabe)));

      el_('line', {
        x1: mx, y1: balkenY - 6, x2: mx, y2: balkenY + balkenH + 6,
        stroke: hue, 'stroke-width': 2,
      }, svg);
      el_('circle', { cx: mx, cy: balkenY - 9, r: 3.5, fill: hue }, svg);

      const rand2 = eng ? 56 : 90;
      const anker = mx < rand2 ? 'start' : mx > B - rand2 ? 'end' : 'middle';
      const t = el_('text', {
        x: mx < rand2 ? L : mx > B - rand2 ? R : mx, y: H - 5,
        'text-anchor': anker, fill: hue, 'font-size': 12, 'font-weight': 500,
        style: 'font-variant-numeric: tabular-nums',
      }, svg);
      t.textContent = `Deine Abgabe ${kurz(abgabe)}`;
    }

    // --- Legende ------------------------------------------------------------
    // Jedes Plättchen ist die Markierung selbst, verkleinert.
    if (legendeEl) {
      legendeEl.textContent = '';
      for (const a of ABSCHNITTE) {
        const s = document.createElement('span');
        const i = document.createElement('i');
        i.style.background = a.fill;
        if (a.stroke) { i.style.border = `1px dashed ${a.stroke}`; }
        s.append(i, document.createTextNode(a.name));
        legendeEl.appendChild(s);
      }
    }

    // --- Befundzeile --------------------------------------------------------
    if (findingEl) findingEl.textContent = lang(f.abgabeGelb);
  }

  // Leerzustand des Rechners: der Rahmen bleibt, ein Satz erklärt ihn.
  function zeigeLeer() {
    if (!leerEl) return;
    leerEl.hidden = !el.ergebnis.hidden;
  }

  function aktualisiere() {
    zeichne();
    zeigeLeer();
  }

  el.refStart.addEventListener('change', aktualisiere);
  el.datum.addEventListener('input', aktualisiere);
  el.datum.addEventListener('change', aktualisiere);
  document.querySelectorAll('input[name="art"]').forEach((r) =>
    r.addEventListener('change', aktualisiere)
  );

  // Der Zeitstrahl misst sich an der Spaltenbreite; bei Größenänderung neu zeichnen.
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(zeichne, 150);
  });

  aktualisiere();
})();
