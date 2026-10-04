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
    const toc = [['plan', 'Two lakes, one day each'], ['day', 'Timetable for a lake day'], ['people', 'Interviews'], ['measure', 'Measurement notes'],
      ['hyp', 'Hypotheses'], ['data', 'Data and IDs'], ['facts', 'What is known'], ['refs', 'References']];
    root.replaceChildren(
      h('div.page-head', h('h1', { text: 'Field guide' }),
        h('p.muted', { text: 'Preliminary investigation of declining water levels at Timure Taal and Chhekmi Taal, Gulmi. Causes are hypotheses to test, not conclusions.' })),
      h('nav.toc', ...toc.map(([id, txt]) => h('a', { href: '#/guide', text: txt, onclick: (ev) => { ev.preventDefault(); document.getElementById('g-' + id).scrollIntoView({ behavior: 'smooth' }); } }))),

      sec('plan', 'Two lakes, one day each',
        ul([
          'Day 1: one lake; Day 2: the other. Set the lake in the header before starting, so every new record is tagged with it.',
          'Three people work in parallel: one on level and depth, one on site features, soils and flows, one on interviews.',
          'Chhekmi has no surveyed baseline: on arrival stand at the lake centre or edge and set its centre on the Data page.',
          'Before leaving each lake: evening level reading, score the hypothesis matrix, appoint a community gauge reader, export every phone.',
        ]),
        table(['Per lake', 'Target'], [
          ['Benchmark + staff gauge', '1 + 1'], ['Water-level readings', 'morning, midday, evening'], ['Site features', '≈ 15'],
          ['Depth transects', '≈ 6 + one QA repeat'], ['Soil samples', '≈ 6 bags + 2 cores'], ['Infiltration tests', '2'],
          ['Flow measurements', 'every visible flow'], ['Household interviews', '8'], ['Key informants', '2'],
        ])),

      sec('day', 'Timetable for a lake day',
        table(['Time', 'Level and depth', 'Site, soils and flows', 'Interviews'], [
          ['07:00', h('span', 'Benchmark, staff gauge, first reading ', links('bm', 'wl')), h('span', 'Perimeter walk ', links('feat')), h('span', 'Courtesy call; plan the households ', links('day'))],
          ['08:30', h('span', 'Depth transects ', links('bath')), h('span', 'Inflows, outlet, lining, cracks, seeps ', links('feat')), h('span', 'Household interviews ', links('hh'))],
          ['11:30', h('span', 'Midday reading; QA transect ', links('wl', 'bath')), h('span', 'Soil samples, infiltration ', links('soil', 'inf')), h('span', 'Key informants ', links('kii'))],
          ['14:00', h('span', 'Remaining transects; high-water marks ', links('feat')), h('span', 'Downslope seeps, flows, catchment divides ', links('feat', 'q')), h('span', 'Household interviews ', links('hh'))],
          ['16:30', h('span', 'Evening reading ', links('wl')), h('span', 'Photo points ', links('feat')), h('span', 'Gauge reader appointed ', links('hh'))],
          ['17:30', 'All together', 'Score the hypothesis matrix', h('span', 'Export every phone ', links('hyp'))],
        ]),
        h('p.muted', { text: 'If time runs short, keep the gauge readings, the inflow/outlet/lining mapping and 5–6 interviews; drop extra transects and the second infiltration test.' })),

      sec('people', 'Interviews',
        ul([
          'Prefer people who have lived near the lake for 15+ years; include women, herders and homestay households, and houses above and below the lake.',
          'Ask neutrally: do not mention the earthquake or the lining before the respondent has described what changed in their own words.',
          'Record years in BS. For any old water level ask for a landmark, and whether they saw it themselves or heard it.',
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

      sec('hyp', 'Hypotheses (score 0–3 at the end of each lake day)',
        table(['Hypothesis', 'Supports', 'Weakens'], TT.HYP.map((x) => [`${x.id} ${x.en}`, x.sup, x.weak])),
        h('div.callout.warn', h('div', { text: 'Do not repair or add lining before confirming whether the problem is too little inflow or too much seepage; a fix for one can worsen the other.' }))),

      sec('data', 'Data and IDs',
        ul([
          'Everything stays on the phone and works offline. Each evening: Data → Field package (.zip), then copy it off the phone.',
          'The team lead imports every phone’s package into one device to merge (newest edit wins, duplicates are skipped).',
          'Lake codes: TT = Timure, CK = Chhekmi. Soil samples TT-A01 / CK-A01 and feature IDs TT-IN-01 / CK-IN-01 are suggested automatically.',
          'Benchmarks BM-1, gauges SG-1, transects T-01, infiltration IF-01 (numbering restarts at each lake).',
        ])),

      sec('facts', 'What is known',
        table(['', 'Timure Taal', 'Chhekmi Taal'], [
          ['Location', 'Chandrakot RM-4, Remi; 28.100514 N, 83.379364 E', 'Gulmi; centre to be set by GPS on site'],
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
