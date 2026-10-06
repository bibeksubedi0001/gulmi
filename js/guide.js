/* Lakes field portal: field guide for one day at Timure Taal and one day at Chhekmi Taal. */
'use strict';
(function () {
  const TT = window.TT;
  const { h } = TT;

  const table = (head, rows) => h('div.tbl-scroll', h('table.tbl.guide-tbl',
    h('thead', h('tr', ...head.map((x) => h('th', { text: x })))),
    h('tbody', ...rows.map((r) => h('tr', ...r.map((c) => h('td', c instanceof Node ? c : { text: String(c) })))))));
  const link = (id) => h('a.form-link', { href: '#/new/' + id, text: TT.FORMS[id].short });
  const links = (...ids) => h('span', ...ids.flatMap((id) => [link(id), ' ']));
  const sec = (id, title, ...kids) => h('section.card.guide-sec', { id: 'g-' + id }, h('h2', { text: title }), ...kids);
  const ul = (items) => h('ul', ...items.map((i) => h('li', { text: i })));
  const ext = (href, text) => h('a', { href, text, target: '_blank', rel: 'noopener noreferrer' });

  TT.renderGuide = function (root) {
    const toc = [['plan', 'Field week'], ['day', 'Full lake day'], ['map', 'Map'], ['people', 'Interviews'], ['measure', 'Measurement notes'],
      ['soil', 'Soil sampling'], ['hyp', 'Hypotheses'], ['data', 'Data and IDs'], ['facts', 'What is known'], ['refs', 'References']];
    root.replaceChildren(
      h('div.page-head', h('h1', { text: 'Field guide' })),
      h('nav.toc', ...toc.map(([id, txt]) => h('a', { href: '#/guide', text: txt, onclick: (ev) => { ev.preventDefault(); document.getElementById('g-' + id).scrollIntoView({ behavior: 'smooth' }); } }))),

      sec('plan', 'Field week, 5–9 October',
        table(['Day', 'Where', 'Work'], [
          ['Mon 5', 'Chandrakot → Timure', h('span', 'Rural municipality office: permission, lining drawings and cost estimate, engineer and ward-4 chair ', links('kii'),
            ' Afternoon at Timure: benchmark, staff gauge, first reading ', links('bm', 'wl'))],
          ['Tue 6', 'Timure', 'Full lake day (timetable below)'],
          ['Wed 7', 'Timure → Tamghas → Chekmi', h('span', '07:00 reading, QA transect, last interviews, gauge reader, cause ranking ', links('wl', 'bath', 'hyp'),
            ' Leave by 13:00. At Chekmi before dark: set the lake centre (Data page), benchmark, gauge, first reading ', links('bm', 'wl'))],
          ['Thu 8', 'Chhekmi', h('span', 'Full lake day, gauge reader, cause ranking; export every phone ', links('hyp'))],
          ['Fri 9', 'Tamghas → Burtibang → Dhorpatan', 'Reserved 4WD jeep, leave 06:00–07:00'],
        ]),
        table(['Travel', 'Road', 'Time'], [
          ['Chandrakot → Timure', '≈ 12 km', '30–45 min'], ['Timure → Tamghas', '≈ 40 km', '2–2.5 h'], ['Tamghas → Chekmi (Resunga-6)', '≈ 6 km', '20–30 min'],
          ['Tamghas → Burtibang', '≈ 55 km', '2.5–3.5 h'], ['Burtibang → Dhorpatan (≈ 2,900 m)', '≈ 30 km, +1,600 m', '2–3 h'],
        ]),
        ul([
          'Set the lake in the header before starting at each lake.',
          'Three people work in parallel: level and depth; site features, soils and flows; interviews.',
          'Dhorpatan: book the jeep by Wednesday, ask about the Burtibang road on Thursday, and sleep in Burtibang if the road is bad or the start is late. Nights near freezing. Dashain starts around 11 October.',
        ]),
        table(['Per lake', 'Target'], [
          ['Benchmark + staff gauge', '1 + 1'], ['Water-level readings', 'evening before; morning, midday, evening'], ['Site features', '≈ 15'],
          ['Depth transects', '≈ 6 + one QA repeat'], ['Soil samples', '≈ 6 across zones A–E'], ['Infiltration tests', '2'],
          ['Flow measurements', 'every visible flow'], ['Household interviews', '8'], ['Key informants', '2'],
        ])),

      sec('day', 'Full lake day (Tue Timure, Thu Chhekmi)',
        table(['Time', 'Level and depth', 'Site, soils and flows', 'Interviews'], [
          ['07:00', h('span', 'Morning reading (install benchmark and gauge first if not done) ', links('bm', 'wl')), h('span', 'Perimeter walk: record the water-edge track ', links('trk', 'feat')), h('span', 'Courtesy call; plan the households ', links('day'))],
          ['08:30', h('span', 'Depth transects ', links('bath')), h('span', 'Inflows, outlet, lining, cracks, seeps ', links('feat')), h('span', 'Household interviews ', links('hh'))],
          ['11:30', h('span', 'Midday reading; QA transect ', links('wl', 'bath')), h('span', 'Soil samples, infiltration ', links('soil', 'inf')), h('span', 'Key informants ', links('kii'))],
          ['14:00', h('span', 'Remaining transects; walk the old high-water line as a track ', links('trk')), h('span', 'Downslope seeps, flows, catchment divides ', links('feat', 'q')), h('span', 'Household interviews ', links('hh'))],
          ['16:30', h('span', 'Evening reading ', links('wl')), h('span', 'Photo points ', links('feat')), h('span', 'Gauge reader appointed ', links('hh'))],
          ['17:30', 'All together', 'Score the cause ranking', h('span', 'Export every phone ', links('hyp'))],
        ]),
        h('p.muted', { text: 'If time runs short, keep the gauge readings, the inflow/outlet/lining mapping and 5–6 interviews; drop extra transects and the second infiltration test.' })),

      sec('map', 'Map',
        table(['Tool', 'Use'], [
          ['My position', 'Live GPS position with its accuracy circle; works offline.'],
          ['Point info', 'Coordinates (lat/lon, UTM 44N), ground elevation and distance from the lake centre at the crosshair; start a site feature or soil sample there, or set the lake centre.'],
          ['Measure', 'Tap points for distance, area and an elevation profile; save the line as a GPS track (e.g. an inflow path traced on the satellite view).'],
          ['Track', 'Walk the water edge or the old high-water line with the map open and the screen on; Stop and save gives the length and enclosed area.'],
          ['Survey layers', 'Show or hide each record type; feature types and track kinds are colour-coded; IDs appear when zoomed in.'],
        ])),

      sec('people', 'Interviews',
        ul([
          'Consent: explain the study (why the lake is declining), about 20 minutes, voluntary, any question can be skipped, names are not reported.',
          'Prefer people who have lived near the lake for 15+ years; include women, herders and homestay households, and houses above and below the lake.',
          'Ask neutrally: do not mention the earthquake or the lining before the respondent has described what changed in their own words.',
          'Record years in BS. For any old water level ask for a landmark, and whether they saw it themselves or heard it.',
          'Voice typing: tap the microphone in any text box or note; EN / NE switches between English and Nepali. It usually needs internet; offline, use the keyboard microphone. Nepali works in Chrome on Android or a computer. iPhone and iPad have no Nepali speech recognition, so NE there uses the Hindi recogniser: it writes Devanagari, but check the words.',
          'Key informants: ward representative, the contractor or masons who built the lining, the lake committee and the oldest residents.',
        ])),

      sec('measure', 'Measurement notes',
        ul([
          'Benchmark on rock or massive concrete; assume RL 100.000 m. Level the gauge zero from it (BS, FS) in the Benchmark form.',
          'Depth: probe to the firm bed; tick QA on repeated soundings. Read the gauge at the start and end of every transect.',
          'Lining: record whether the outside ground is higher than the crest, whether water ponds against it, and whether weep holes exist.',
          'Seeps: note whether they lie below the lake level and compare EC / temperature with the lake water.',
          'Soil zones: A exposed lake margin, B inflow swale, C next to (never through) the lining, D downslope wet spot, E undisturbed control.',
          'Infiltration on dry soil is not lake-bed seepage; treat it as supporting evidence only.',
        ])),

      sec('soil', 'Soil sampling, moisture and water availability (no tools)',
        table(['Step', 'How'], [
          ['Location', 'A representative spot. Avoid recently disturbed soil, animal burrows, roads and water channels; zones B–D are next to channels or the lining by design, so tick what is present.'],
          ['Depth', '5–15 cm (2–6 in), the root zone; dig with the hands or a stick.'],
          ['Collection', 'Remove leaves, stones and litter; take soil from the bottom of the hole, not the surface.'],
          ['Quantity', 'A handful, squeezed in the palm for the tests below.'],
        ]),
        table(['Moisture (% of available water)', 'Feel and appearance', 'Meaning'], [
          ['Very dry (0–25%)', 'Powdery or dusty; no cohesion, falls apart instantly; no stain on fingers', 'Plants likely stressed'],
          ['Slightly moist (25–50%)', 'Weak ball that breaks easily; finger marks visible', 'May need water soon'],
          ['Moist (50–75%)', 'Ball holds its shape; slight stain on fingers', 'Ideal for most plants'],
          ['Wet (75–100%)', 'Sticks strongly to fingers; easily moulded; leaves water stains', 'High water content'],
          ['Saturated', 'Water appears when squeezed', 'At or above field capacity; do not add water'],
        ]),
        table(['Texture', 'Dry', 'Moist', 'Wet'], [
          ['Sand', 'Loose, flows through fingers', 'Weak ball', 'Slight sticking'],
          ['Silty', 'Smooth and floury, like flour or talc', 'Silky, smooth ball; ribbon flakes and breaks', 'Slippery and soapy; slightly sticky'],
          ['Loam', 'Crumbly', 'Forms a pliable ball', 'Slick and sticky'],
          ['Clay', 'Hard clods', 'Strong ball; ribbons when pressed', 'Very sticky, heavy coating'],
        ]),
        table(['Sign', 'Water availability'], [
          ['Crumbles instantly', 'Very low'], ['Forms a ball but cracks', 'Moderate'], ['Forms a smooth ball', 'High'],
          ['Water appears when squeezed', 'At or above field capacity'], ['Plants wilting in the early morning', 'Critically low'],
          ['Plants wilting only in the afternoon', 'Moderate'], ['Dark green, turgid leaves', 'Adequate'],
        ])),

      sec('hyp', 'Hypotheses (score 0–3 at the end of each lake day)',
        table(['Hypothesis', 'Supports', 'Weakens'], TT.HYP.map((x) => [`${x.id} ${x.en}`, x.sup, x.weak])),
        h('div.callout.warn', h('div', { text: 'Do not repair or add lining before confirming whether the problem is too little inflow or too much seepage; a fix for one can worsen the other.' }))),

      sec('data', 'Data and IDs',
        ul([
          'Everything stays on the phone and works offline. Each evening: Data → Field package (.zip), then copy it off the phone.',
          'Map offline: the offline map (terrain, 20 m contours, roads, paths, streams, buildings, place names) covers both lake areas and Tamghas. Satellite tiles viewed once online are kept for offline use.',
          'The team lead imports every phone’s package into one device to merge (newest edit wins, duplicates are skipped).',
          'Lake codes: TT = Timure, CK = Chhekmi. Soil samples TT-A01 / CK-A01 and feature IDs TT-IN-01 / CK-IN-01 are suggested automatically.',
          'Benchmarks BM-1, gauges SG-1, transects T-01, infiltration IF-01 (numbering restarts at each lake).',
        ])),

      sec('facts', 'What is known',
        table(['', 'Timure Taal', 'Chhekmi Taal'], [
          ['Location', 'Chandrakot RM-4, Remi; 28.100514 N, 83.379364 E', 'Chekmi, Resunga-6 (≈ 4 km west of Tamghas); centre set by GPS on site'],
          ['Water area', '≈ 3,638 m² (2026 imagery); 0.5 ha core area in the 2017 inventory', 'To be mapped'],
          ['Catchment', '13.87 ha (DEM); 16.6 ha in the 2017 inventory', 'Not yet delineated'],
          ['Reported change', 'Decline locally linked to the period after 2072 (2015)', 'To be established in interviews'],
        ])),

      sec('refs', 'References',
        h('ol.refs',
          h('li', 'DoFSC (2017). Wetlands of Western Nepal — Timure Pokhari profile. ', ext('https://www.codefundnepal.org.np/wp-content/uploads/2022/12/1593881767Setting_Dof_23_final_-July_book1.pdf', 'PDF')),
          h('li', 'Kantipur (2024). Domestic tourists growing at Timure Lake. ', ext('https://ekantipur.com/lumbini-pradesh/2024/10/11/domestic-tourists-growing-at-timure-lake-in-gulmi-10-21.html', 'Article')),
          h('li', 'Gorkhapatra (2025). Drying Timure Lake. ', ext('https://gorkhapatraonline.com/news/152377', 'Article')),
          h('li', 'Rosenberry, Duque & Lee (2020). Seepage meters for groundwater–surface water exchange. ', ext('https://www.usgs.gov/publications/history-and-evolution-seepage-meters-quantifying-flow-between-groundwater-and-surface', 'USGS')),
          h('li', 'USDA NRCS. Pond Sealing or Lining — Compacted Soil Treatment (Code 520). ', ext('https://www.nrcs.usda.gov/sites/default/files/2022-09/Pond_Sealing-Liner-Compacted-Soil-520-CPS-May-2016.pdf', 'PDF')),
          h('li', 'GEOINFRA (2025). Seepage control through Rankbang Lake, Rolpa. ', ext('https://geoinfra.com.np/detail-study-for-seepage-control-through-the-rankbang-lake-kotgaun-rolpa/', 'GEOINFRA'))),
        h('p.muted.sm', { text: 'Map reference layer © OpenStreetMap contributors (ODbL); satellite imagery © Esri and partners.' })),
    );
  };
})();
