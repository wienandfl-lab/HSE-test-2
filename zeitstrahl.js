// Zeitstrahl – Heidelberg School of Education
// Nutzt script.js (fristen, lang, kurz, ampel, plusTage, ausEingabe, el) —
// dort wird NICHTS geändert.

(() => {
  'use strict';

  const zeichenflaeche = document.getElementById('zeitstrahl');
  const legendeEl      = document.getElementById('zeitstrahl-legende');
  const leerEl         = document.getElementById('rechner-leer');
  const findingEl      = document.getElementById('finding-datum');
  if (!zeichenflaeche) return;

  const NS     = 'http://www.w3.org/2000/svg';
  const TAG_MS = 24 * 60 * 60 * 1000;

  const ABSCHNITTE = [
    { name: 'Bearbeitung (17 Wo.)', fill: 'var(--chart)' },
    { name: 'Nur noch Bescheinigung', fill: 'var(--warn-bg)', stroke: 'var(--warn)' },
    { name: 'Bewertung & Prüfungsamt', fill: 'var(--chart-track)' },
  ];

  // ---- DOM-Helfer ----------------------------------------------------------

  function el_(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ---- Persistenter Marker-Container (einmalig angelegt) -------------------
  // Wird per translateX bewegt statt neu gebaut → CSS-Transition möglich.

  let markerG     = null;   // <g class="eingabe-marke">
  let markerLinie = null;
  let markerPunkt = null;
  let markerText  = null;
  let markerSvg   = null;   // SVG, zu dem markerG gehört (prüfen bei Rebuild)

  // ---- Legende (einmalig, kein Rebuild pro Keystroke) ---------------------

  function bautLegende() {
    if (!legendeEl) return;
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

  // ---- Vollständiger Rebuild (refStart-Change, Resize) ---------------------
  // Erstellt alle statischen SVG-Nodes neu; markerG wird als letztes Kind
  // des neuen SVG angehängt, damit es im Stapel immer oben liegt.

  let cachedBreite = 0;
  let cachedF      = null;
  let cachedVon    = null;
  let cachedBis    = null;
  let cachedX      = null;
  let cachedEng    = false;
  let cachedH      = 0;
  let cachedBalkenY = 0;
  let cachedBalkenH = 0;

  function baut() {
    const f   = fristen(Number(el.refStart.value));
    const von = f.anmeldungGruen;
    const bis = f.rp;
    const spanne = (bis - von) / TAG_MS;

    const B   = Math.max(300, Math.round(zeichenflaeche.getBoundingClientRect().width) || 1040);
    const eng = B < 560;
    const H   = eng ? 150 : 132;
    const L = 6, R = B - 6;
    const balkenY = eng ? 62 : 52, balkenH = eng ? 28 : 36;
    const x = (d) => L + ((d - von) / TAG_MS / spanne) * (R - L);

    // Cache für updateMarker
    cachedBreite = B; cachedF = f; cachedVon = von; cachedBis = bis;
    cachedX = x; cachedEng = eng; cachedH = H;
    cachedBalkenY = balkenY; cachedBalkenH = balkenH;

    zeichenflaeche.textContent = '';
    markerG = markerLinie = markerPunkt = markerText = null;

    const svg = el_('svg', {
      viewBox: `0 0 ${B} ${H}`,
      role: 'img',
      'aria-label': `Zeitstrahl vom ${lang(von)} bis zum ${lang(bis)}: `
        + `17 Wochen Bearbeitung, dann Bewertung und Prüfungsamt bis zur Frist `
        + `des Regierungspräsidiums.`,
    }, zeichenflaeche);
    markerSvg = svg;

    const bearbeitungBis = f.abgabeGruen;

    // Segmente
    el_('rect', {
      x: x(von), y: balkenY, width: x(bearbeitungBis) - x(von), height: balkenH,
      rx: 3, class: 'zs-seg-bearb', fill: 'var(--chart)',
    }, svg);
    el_('rect', {
      x: x(bearbeitungBis), y: balkenY, width: x(bis) - x(bearbeitungBis), height: balkenH,
      rx: 3, fill: 'var(--chart-track)',
    }, svg);
    el_('rect', {
      x: x(bearbeitungBis), y: balkenY,
      width: Math.max(2, x(f.abgabeGelb) - x(bearbeitungBis)), height: balkenH,
      rx: 3, fill: 'var(--warn-bg)', stroke: 'var(--warn)', 'stroke-width': 1,
      'stroke-dasharray': '3 3',
    }, svg);

    // SVG <title> für nativen Tooltip
    const t0 = document.createElementNS(NS, 'title');
    t0.textContent =
      `Bearbeitungszeit: ${lang(von)} bis ${lang(bearbeitungBis)}. `
      + `Kulanzfenster: ${lang(bearbeitungBis)} bis ${lang(f.abgabeGelb)}. `
      + `Bewertungsphase bis ${lang(bis)}.`;
    svg.insertBefore(t0, svg.firstChild);

    // Balken-Label
    const breiteBearb = x(bearbeitungBis) - x(von);
    if (breiteBearb > 150 && !eng) {
      el_('text', {
        x: x(von) + breiteBearb / 2, y: balkenY + balkenH / 2 + 4,
        'text-anchor': 'middle', 'font-size': 12, class: 'zs-label',
      }, svg).textContent = '17 Wochen Bearbeitungszeit';
    }

    // Statische Marken
    const marken = [
      { d: von,           titel: 'Anmeldung',                  oben: true  },
      { d: f.abgabeGruen, titel: 'Abgabe',                     oben: false },
      { d: bis,           titel: eng ? 'RP' : 'Unterlagen beim RP', oben: true  },
    ];
    for (const m of marken) {
      const mx  = x(m.d);
      const rand = eng ? 52 : 80;
      const anker = mx < rand ? 'start' : mx > B - rand ? 'end' : 'middle';
      const tx  = mx < rand ? L : mx > B - rand ? R : mx;

      el_('line', {
        x1: mx, y1: m.oben ? 32 : balkenY + balkenH,
        x2: mx, y2: m.oben ? balkenY : balkenY + balkenH + 11,
        stroke: 'var(--text)', 'stroke-width': 1,
      }, svg);
      el_('text', {
        x: tx, y: m.oben ? 26 : balkenY + balkenH + 27,
        'text-anchor': anker,
        'font-size': eng ? 12 : 13,
        class: 'zs-datum',
      }, svg).textContent = kurz(m.d);
      el_('text', {
        x: tx, y: m.oben ? 12 : balkenY + balkenH + 42,
        'text-anchor': anker,
        'font-size': eng ? 11 : 12,
        class: 'zs-rolle',
      }, svg).textContent = m.titel;
    }

    // Marker-Gruppe (persistente Nodes, damit CSS-Transition greift)
    markerG = el_('g', { class: 'eingabe-marke', visibility: 'hidden' }, svg);
    markerLinie = el_('line', {
      x1: 0, y1: balkenY - 6, x2: 0, y2: balkenY + balkenH + 6,
      'stroke-width': 2, class: 'zs-marke-linie',
    }, markerG);
    markerPunkt = el_('circle', { cx: 0, cy: balkenY - 9, r: 4, class: 'zs-marke-punkt' }, markerG);
    markerText  = el_('text', {
      x: 0, y: H - 5, 'font-size': 12, class: 'zs-marke-text',
    }, markerG);

    if (findingEl) findingEl.textContent = lang(f.abgabeGelb);
  }

  // ---- Schneller Marker-Update (input-Event, Radio-Change) -----------------
  // Nur markerG transform + Farbe + Text ändern — kein DOM-Rebuild.

  function updateMarker() {
    if (!markerG || !cachedX) return;

    const eingabe = ausEingabe(el.datum.value);
    if (!eingabe) {
      markerG.setAttribute('visibility', 'hidden');
      return;
    }

    const art    = document.querySelector('input[name="art"]:checked').value;
    const abgabe = art === 'anmeldung' ? plusTage(eingabe, 7 * 17) : eingabe;
    const farbe  = ampel(abgabe, cachedF);
    const hue    = farbe === 'gruen' ? 'var(--pos)' : farbe === 'gelb' ? 'var(--warn)' : 'var(--neg)';

    const B   = cachedBreite;
    const L   = 6, R = B - 6;
    const mx  = Math.min(R, Math.max(L, cachedX(abgabe)));
    const H   = cachedH;
    const eng = cachedEng;
    const balkenY = cachedBalkenY, balkenH = cachedBalkenH;

    // Marker bewegen (CSS-Transition auf .eingabe-marke läuft)
    markerG.setAttribute('transform', `translate(${mx}, 0)`);
    markerG.setAttribute('visibility', 'visible');

    // Farbe
    markerLinie.style.stroke = hue;
    markerPunkt.style.fill   = hue;
    markerText.style.fill    = hue;

    // Koordinaten relativ zur Gruppe (mx=0, da translate)
    markerLinie.setAttribute('x1', 0); markerLinie.setAttribute('x2', 0);
    markerPunkt.setAttribute('cx', 0);

    // Textanker und -position
    const rand2 = eng ? 56 : 90;
    const anker = mx < rand2 ? 'start' : mx > B - rand2 ? 'end' : 'middle';
    const relX  = mx < rand2 ? L - mx : mx > B - rand2 ? R - mx : 0;
    markerText.setAttribute('text-anchor', anker);
    markerText.setAttribute('x', relX);
    markerText.setAttribute('y', H - 5);
    markerText.textContent = `Deine Abgabe ${kurz(abgabe)}`;
  }

  // ---- Befund-Animation (nur bei refStart-Wechsel) -------------------------

  function animiereBefund() {
    if (!findingEl) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    findingEl.animate(
      [{ opacity: 0.4 }, { opacity: 1 }],
      { duration: 200, easing: 'cubic-bezier(0.23,1,0.32,1)' }
    );
  }

  // ---- Stat-Werte einblenden (bei refStart-Wechsel) ------------------------

  function animiereStats() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.stat__value').forEach((node, i) => {
      node.animate(
        [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 220, delay: i * 50, easing: 'cubic-bezier(0.23,1,0.32,1)', fill: 'backwards' }
      );
    });
  }

  // ---- Leerzustand ---------------------------------------------------------

  function zeigeLeer() {
    if (!leerEl) return;
    leerEl.hidden = !el.ergebnis.hidden;
  }

  // ---- Listener ------------------------------------------------------------

  let resizeTimer;

  el.refStart.addEventListener('change', () => {
    baut();
    updateMarker();
    zeigeLeer();
    animiereBefund();
    animiereStats();
  });

  el.datum.addEventListener('input', () => {
    updateMarker();   // nur Marker, kein Rebuild
    zeigeLeer();
  });
  el.datum.addEventListener('change', () => {
    updateMarker();
    zeigeLeer();
  });

  document.querySelectorAll('input[name="art"]').forEach((r) =>
    r.addEventListener('change', () => {
      updateMarker();
      zeigeLeer();
    })
  );

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cachedBreite = 0;   // Cache invalidieren
      baut();
      updateMarker();
    }, 150);
  });

  // ---- Init ----------------------------------------------------------------

  bautLegende();
  baut();
  updateMarker();
  zeigeLeer();

})();
