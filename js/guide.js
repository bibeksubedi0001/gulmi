/* Timure Taal field portal: field guide (methodology condensed from the 3 Oct 2026 field study report). */
'use strict';
(function () {
  const TT = window.TT;
  const { h, L } = TT;
  const t = (ne, en) => ({ ne, en });

  const table = (head, rows) => h('div.tbl-scroll', h('table.tbl.guide-tbl',
    h('thead', h('tr', ...head.map((x) => h('th', { text: x })))),
    h('tbody', ...rows.map((r) => h('tr', ...r.map((c) => h('td', c instanceof Node ? c : { text: String(c) })))))));
  const formLink = (id) => h('a.form-link', { href: '#/new/' + id, text: TT.FORMS[id].short });
  const sec = (id, title, ...kids) => h('section.card.guide-sec', { id: 'g-' + id }, h('h2', L(title)), ...kids);
  const ul = (items) => h('ul', ...items.map((i) => h('li', typeof i === 'string' ? { text: i } : L(i))));
  const ext = (href, text) => h('a', { href, text, target: '_blank', rel: 'noopener noreferrer' });

  TT.renderGuide = function (root) {
    const toc = [
      ['glance', 'Study at a glance'], ['evidence', 'Conflicting baseline figures'], ['hyp', 'Hypotheses H1–H8'], ['days', '4–5 day field programme'],
      ['community', 'Community survey design'], ['control', 'Benchmark, gauge & levelling'], ['bathy', 'Bathymetry'], ['soil', 'Soils & infiltration'],
      ['seep', 'Seepage & subsurface'], ['lining', 'Lining & drainage checklist'], ['balance', 'Water balance'], ['ladder', 'Investigation ladder'],
      ['data', 'Data management & IDs'], ['safety', 'Safety & ethics'], ['refs', 'References'],
    ];
    root.replaceChildren(
      h('div.page-head', h('h1', L(t('फिल्ड निर्देशिका', 'Field guide'))),
        h('p.muted', { text: 'Condensed from “Preliminary engineering investigation of declining water level — Timure Taal, Gulmi” (work in progress, 3 October 2026). Causes remain to be field-tested.' })),
      h('nav.toc', ...toc.map(([id, txt]) => h('a', { href: '#/guide', dataset: { target: 'g-' + id }, text: txt, onclick: (e) => { e.preventDefault(); document.getElementById('g-' + id).scrollIntoView({ behavior: 'smooth' }); } }))),

      sec('glance', t('अध्ययन एक नजरमा', 'Study at a glance'),
        h('div.callout.key', h('div', h('b', { text: 'Central question. ' }), 'Why has Timure Taal, a small ridge-top natural lake, experienced declining water levels in recent years, and what combination of changes in recharge, drainage, lake-bed/embankment seepage, lining/construction, climate, land use or subsurface conditions best explains the decline?')),
        table(['Item', 'Value', 'Note'], [
          ['Location', 'Timure, Chandrakot Rural Municipality-4, Remi, Gulmi, Lumbini Province', ''],
          ['Lake coordinate', '28°06′01.85″N 83°22′45.71″E (28.100514, 83.379364)', 'UTM 44N ≈ E 733 765, N 3 110 624'],
          ['Altitude', '≈ 1,951.8 m (DEM minimum) – 1,956 m reported', ''],
          ['Digitised water area', '3,637.56 m² (0.364 ha)', 'Satellite-image date specific'],
          ['DEM catchment (union of 7 lake cells)', '138,698 m² = 13.87 ha', 'Copernicus GLO-30, 28.66 m cells, EPSG:32644'],
          ['Catchment : lake ratio', '≈ 38 : 1', ''],
          ['Catchment elevation', 'min 1,951.8 · mean 1,987.1 · max 2,037.6 m', 'Relief 85.8 m'],
          ['Catchment slope', 'mean 15.0° · median 14.5° · max 30.7°', 'Runoff can be rapid; micro-drainage dominates delivery'],
          ['Contributing terrain', 'West, north-west and north of the lake', 'Lake sits in the lower / south-eastern part'],
        ]),
        h('p', { text: 'The DEM catchment is a first-order topographic model. At ~28.7 m resolution the lake covers only seven cells, so roads, drains, culverts, lining and small berms are invisible to it. Field verification decides the effective hydrological catchment.' })),

      sec('evidence', t('आधार तथ्याङ्कमा भिन्नता', 'Conflicting baseline figures'),
        table(['Source', 'What it reports'], [
          ['DoFSC wetland inventory (2017)', 'Core area 0.5 ha; average depth 5 m; basin 16.6 ha; inlet none; outlet a regulated drain; loamy sand.'],
          ['Kantipur (2024)', 'Area ≈ 2,400 m²; altitude ≈ 1,956 m; no visible spring/source; historically persistent water.'],
          ['Gorkhapatra (2025)', '≈ 4 ropani, depth ≈ 3 m; decline linked locally to the post-2015 period; recharge ponds and plantation.'],
          ['GIS digitisation (2026)', 'Visible water ≈ 3,637.56 m²; DEM catchment 13.87 ha (≈ 16 % smaller than the inventory basin).'],
          ['OpenStreetMap outline (unverified)', '≈ 3,351 m² in UTM 44N; centroid 11 m from the report coordinate.'],
        ]),
        h('p', { text: 'These are not mutually consistent (dates, seasons, definitions, quality, or real change). A measured baseline — shoreline, water-surface level, bathymetry and outlet condition — is a primary output of this campaign.' })),

      sec('hyp', t('परिकल्पनाहरू', 'Working hypotheses — to test, not conclusions'),
        table(['Hypothesis', 'Testable statement', 'Supports', 'Weakens'], TT.HYP.map((x) => [`${x.id} ${x.en}`, x.test, x.sup, x.weak])),
        h('p.muted', { text: 'Score each hypothesis 0–3 in the Hypothesis–evidence matrix (form HM) after Day 1, Day 3 and at the end. Timing alone is not proof (especially for H4).' })),

      sec('days', t('४–५ दिने फिल्ड कार्यक्रम', '4–5 day field programme'),
        table(['Day', 'Main tasks', 'Forms'], [
          ['Day 0 — before travel', 'Base maps and printed catchment; old photographs and construction records; key informants; install this portal on every phone and open it once offline; calibrate meters; label sample bags/cores; permissions (sampling, drone).', h('span', formLink('kit'), ' ', formLink('day'))],
          ['Day 1 — reconnaissance & control', 'Walk the perimeter and preliminary catchment. Fixed benchmark and staff gauge. Map shoreline, lining, roads, culverts, drains, depressions, gullies, recharge ponds, inflows/outflows, springs, cracks, wet spots. Geotagged photos.', h('span', formLink('bm'), ' ', formLink('lev'), ' ', formLink('feat'), ' ', formLink('lin'), ' ', formLink('wl'))],
          ['Day 2 — geometry & bathymetry', 'Shoreline and water-surface elevation. Transects across the lake; depth + GPS at regular intervals; QA repeats. High-water marks and exposed former bed.', h('span', formLink('bath'), ' ', formLink('lev'), ' ', formLink('pl'), ' ', formLink('wl'))],
          ['Day 3 — hydrology, soils & seepage', 'Trace runoff paths ridge → lake; road-drain interception; soil samples; infiltration tests on dry soil; lining joints; downslope wet zones and springs; measure visible flows.', h('span', formLink('catch'), ' ', formLink('soil'), ' ', formLink('inf'), ' ', formLink('seep'), ' ', formLink('q'), ' ', formLink('wq'))],
          ['Day 4 — community & construction history', 'Household and key-informant interviews; people involved in lining/road/recharge works; collect/scan old photos; dated shoreline markers.', h('span', formLink('hh'), ' ', formLink('kii'), ' ', formLink('fgd'), ' ', formLink('ev'), ' ', formLink('hist'))],
          ['Day 5 — repeat / close gaps', 'Repeat level/depth reference; revisit uncertain flow paths after rain; repeat suspect measurements; complete missing interviews/samples; check sample log, photo and GPS inventory; export every phone.', h('span', formLink('wl'), ' ', formLink('hyp'))],
        ]),
        h('p', { text: 'Read the lake level from the same gauge at least morning and evening every day, and after any rain.' })),

      sec('community', t('समुदाय सर्वेक्षणको ढाँचा', 'Community survey design'),
        h('h3', { text: 'Who to interview (recommended sample)' }),
        table(['Instrument', 'Who', 'Recommended number'], [
          ['Household questionnaire (HH)', 'Long-term residents of every settlement around the lake (prioritise ≥ 15 years or born here); balance women and men, elders and herders, homestay households; include households above and below the lake.', '30–40 interviews, or until new interviews add no new facts (saturation). At least one third women.'],
          ['Key-informant interview (KII)', 'Ward chair/members, municipal engineer, Division Forest / soil conservation staff, contractor and masons who built the lining, lake/user committee, homestay operators, oldest residents, teacher/local historian.', '8–12'],
          ['Focus-group discussion (FGD)', 'One group of elders; one group of women/herders (separately, so all voices are heard).', '2 sessions'],
          ['Evidence register (EV)', 'Every old photo, video, document, drawing, BOQ or news item found.', 'All items'],
        ]),
        h('h3', { text: 'Rules for neutral, verifiable answers' }),
        ul([
          'Do not mention the earthquake, concrete lining or any other cause before the respondent has described what they observed (the unprompted question D4 comes before sections H–I).',
          'Record years in BS; the portal shows AD automatically. Use the memory anchors beside the year timeline (2072 earthquake, 2074 elections, 2076 lockdown …).',
          'Whenever historical water level is estimated, ask for a landmark (stone, tree, path, wall, building) or photo and record a GPS point.',
          'For each major claim ask: When did you first notice this? What physical evidence do you remember? Who else can verify it? Then tag Seen / Heard.',
          'Treat a claim as corroborated only when two independent witnesses agree AND a physical or documentary trace exists (photo, mark, record).',
          'Use “Don’t know” freely; a wrong guess is worse than a blank.',
        ]),
        h('h3', { text: 'Consent and privacy' }),
        ul(['Read the consent script; record consent before any question.', 'Names and phone numbers are optional and are removed from Excel/GIS exports unless you tick “include personal identifiers”.', 'Photograph documents and people’s property only with permission; return originals.']),
        h('p', h('a.btn', { href: '#/print/hh', text: 'Print blank household questionnaire (paper backup)' }))),

      sec('control', t('बेन्चमार्क, गेज र लेभलिङ', 'Benchmark, gauge and levelling'),
        ul([
          'Set a benchmark (BM-1) on bedrock or massive concrete that will not move with soft bank material; average the GPS for 60 s; record witness distances.',
          'Install a graduated staff gauge (SG-1) and level its zero from BM-1 (Benchmark form computes gauge-zero RL = BM RL + BS − FS).',
          'Use an assumed datum (e.g. BM-1 = 100.000 m) unless a known height exists; phone GPS altitude is not accurate enough for levels.',
          'Level the water surface, high-water marks, lining crest and outside ground (form LEV). The field book checks ΣBS − ΣFS = last RL − first RL and the closing error against ±12√K mm.',
        ])),

      sec('bathy', t('बाथिमेट्री', 'Bathymetry'),
        ul([
          'Lay out transects across the lake in both directions; for a lake ≈ 100 m × 50 m use 5–10 m spacing.',
          'Sound every 3–5 m or at changes of bed shape; capture GPS on each sounding row.',
          'Note soft-sediment penetration separately from the firm-bed depth.',
          'Repeat several points or one whole transect for QA.',
          'Read the gauge at the start and end of each transect so depths reduce to bed RL; interpolate in QGIS afterwards (depth contours, area–capacity).',
          'Photograph and measure high-water marks and exposed benches for historical shoreline comparison.',
        ])),

      sec('soil', t('माटो र इन्फिल्ट्रेसन', 'Soils and infiltration'),
        table(['Zone', 'Suggested samples', 'Purpose'], [
          ['A Exposed lake margin / former bed', '3–4 disturbed; 1–2 cores where natural soil is exposed', 'Texture, fines, plasticity, moisture, permeability'],
          ['B Natural inflow / swale zones', '2–3 (north / north-west / west runoff paths)', 'Infiltration / recharge potential; altered pathways'],
          ['C Lining–soil interface / embankment', '2–3 adjacent to, not through, concrete', 'Material, compaction, preferential paths'],
          ['D Downslope suspected seepage / wet spots', '1–2 plus moisture observations', 'Compare wet-zone material with dry controls'],
          ['E Control site', '1–2 undisturbed upslope', 'Reference texture / permeability'],
        ]),
        h('p', { text: 'Target ≈ 10–15 disturbed samples + 4–6 undisturbed cores. Never puncture or core through concrete or engineered lining — that requires a separately approved geotechnical investigation.' }),
        h('h3', { text: 'Procedure' }),
        h('ol', ...['Assign a unique sample ID before collection (TT-A01, TT-B02 …; the portal suggests the next ID per zone).', 'Record GPS, elevation, date/time, zone, land cover, surface condition, depth, moisture, photos and nearby structures.', 'Disturbed: remove litter, collect enough representative material, seal immediately.', 'Undisturbed: drive a clean ring/tube vertically, trim flush, cap both ends, mark orientation and depth.', 'Auger profile: log colour, texture, gravel, roots, layering, cracks and moisture per interval.', 'Keep wet samples sealed; protect cores from vibration.', 'Maintain the sample register and chain of custody to the laboratory.'].map((x) => h('li', { text: x }))),
        table(['Laboratory test', 'Why'], [
          ['Natural water content', 'Baseline moisture; compare suspected wet/seepage zones'], ['Grain-size distribution', 'Sand/silt/clay/gravel proportions for permeability and erosion'],
          ['Atterberg limits', 'Plasticity and clayey sealing potential'], ['Specific gravity, bulk/dry density', 'Classification and compaction'],
          ['Permeability (falling / constant head)', 'Method must match the material'], ['Organic content', 'Lake-bed / wetland sediments'], ['Compaction', 'Only if engineered fill is suspected'],
        ]),
        h('div.callout', h('div', { text: 'A field infiltration test on dry soil measures infiltration behaviour; it is not saturated seepage through the submerged lake bed. Treat infiltration, laboratory K, lake-level recession and direct seepage measurements as complementary evidence.' }))),

      sec('seep', t('चुहावट र जमिनमुनिको अनुसन्धान', 'Seepage and subsurface'),
        h('h3', { text: 'Low-cost screening during this visit' }),
        ul(['Walk the downstream / southern / eastern slopes: wet patches, lush vegetation, seeps, springs, soft ground, iron staining, piping.', 'Inspect lining joints, cracks, settlement, separation, edge scour.', 'Lake level morning and evening; in a rain-free period compare recession with evaporation (dashboard flags excess falls).', 'Measure visible inflows/outflows repeatedly.', 'Temperature/EC of lake vs seeps is a screening clue only.', 'Seepage meters at natural-bed points with replicates, if safe and permitted.']),
        h('h3', { text: 'Second phase — only if evidence indicates leakage' }),
        table(['Method', 'Use'], [
          ['Electrical resistivity tomography (ERT)', 'Image saturated zones, fractures or seepage paths'], ['Piezometers / shallow wells', 'Hydraulic head and gradient direction around the lake'],
          ['Seepage meters', 'Exchange across the sediment–water interface'], ['Tracer testing', 'Connectivity, with permission, safe dosing and downstream monitoring'],
          ['Boreholes / cores', 'Stratigraphy, fractures, liner/subgrade condition'], ['Hydrochemistry / stable isotopes', 'Separate rainfall, groundwater and evaporative signatures'],
        ])),

      sec('lining', t('कंक्रिट lining र निकास जाँच', 'Lining, inflow and drainage checklist'),
        table(['Item', 'Field check'], [
          ['Construction history', 'Years, agency/contractor, purpose, drawings/BOQ, extent, excavation, original ground level, repairs'],
          ['Pre-lining inflow', 'Where runoff or shallow lateral flow entered — ask residents to point'],
          ['Current surface inflow', 'Every swale, ditch, road drain, culvert and low point relative to the crest'],
          ['Blocked pathways', 'Raised edges, walls across former swales, drains ending outside the lake, roads intercepting runoff'],
          ['Weep holes / vents', 'Openings intentionally provided for lateral entry or pressure relief'],
          ['Cracks and joints', 'Length/width, open joints, settlement, separation, honeycombing, staining'],
          ['Lining extent', 'Perimeter, bed, embankment or selected sections — do not assume full lining'],
          ['Outside ground level', 'Higher or lower than the crest; can water physically cross?'],
          ['Post-lining change', 'Did decline precede the lining, follow it immediately, or change gradually?'],
          ['Alternative explanations', 'Roads, land use, sediment, drought and earthquake at the same locations'],
        ])),

      sec('balance', t('जल सन्तुलन', 'Water balance'),
        h('div.formula', { text: 'ΔS = P_lake + Q_surface,in + G_in + Q_artificial,in − E_lake − Q_surface,out − G_out − Q_withdrawal' }),
        h('p', { text: 'A 4–5 day visit cannot close the annual balance, but it establishes which terms exist, which are absent, and what must be monitored. The key unknowns are effective surface inflow after micro-drainage change and groundwater/seepage exchange. Leave the gauge in place and arrange weekly community readings (the household questionnaire, section L, records volunteer gauge readers).' })),

      sec('ladder', t('अनुसन्धानको क्रम', 'Investigation ladder'),
        table(['Level', 'Purpose'], [
          ['1 — Current 4–5 day survey', 'Reconnaissance, drainage mapping, bathymetry, benchmark and gauge, community survey, basic soils, construction inspection'],
          ['2 — Short monitoring (1–3 months / seasonal)', 'Lake-level readings, rainfall, selected inflows, repeat references; separates seasonal behaviour from persistent deficit'],
          ['3 — Targeted seepage / hydrogeology', 'Seepage meters, piezometers, ERT/SP, detailed permeability, hydrochemistry — only if Levels 1–2 point to subsurface loss'],
          ['4 — Design of intervention', 'Only after the mechanism is established: restore inflow/drains, modify lining/weep paths, repair leakage, clay blanket/cut-off/grouting, recharge, sediment management'],
        ]),
        h('div.callout.warn', h('div', h('b', { text: 'Most important practical point. ' }), 'Do not repair or add more lining before confirming whether the lake’s problem is insufficient inflow or excessive outflow/seepage. A measure that helps one mechanism can worsen the other.'))),

      sec('data', t('डाटा व्यवस्थापन', 'Data management and IDs'),
        ul([
          'Everything is stored on the phone (works offline). Nothing is uploaded automatically.',
          'Every evening: Data → “Field package (.zip)” on every phone, then copy the ZIPs to a laptop or cloud folder. The team lead imports all ZIPs into one device to merge (newest edit wins; duplicates are skipped).',
          'Allow the browser to keep storage persistent (Data page) and never clear site data before exporting.',
          'IDs: BM-1 / TBM-1 benchmarks · SG-1 staff gauge · LV-01 levelling line · T-01 transects · L-01 lining segments · TT-A01 soil samples · IF-01 infiltration · SP-01 seeps · SM-01a seepage meters · PL-01 photo stations. Feature IDs (IN-01, CV-01, CR-01 …) are suggested automatically.',
          'Photo IDs (P-XX-0001) are burned into a strip below each photo with time and GPS; the original image area is not covered.',
          'Excel export includes a Codebook sheet (question text in English and Nepali, options, report reference R1–R65) and derived water-level series; GeoJSON/KML open directly in QGIS / Google Earth.',
        ])),

      sec('safety', t('सुरक्षा र आचारसंहिता', 'Safety and ethics'),
        ul(['Life jacket for any boat or deep wading; never sound alone.', 'Avoid steep wet slopes after rain; watch for loose material on cut slopes and road edges.', 'Carry first aid and share the day’s plan; note the nearest health post.', 'No drone flights without permission; respect private land and crops when sampling.', 'Explain the study honestly; do not promise works or compensation.', 'Share findings back with the community and the municipality.'])),

      sec('refs', t('सन्दर्भ सामग्री', 'References and desk sources'),
        h('ol.refs',
          h('li', 'Department of Forests and Soil Conservation (2017). Wetlands of Western Nepal — Timure Pokhari profile. ', ext('https://www.codefundnepal.org.np/wp-content/uploads/2022/12/1593881767Setting_Dof_23_final_-July_book1.pdf', 'PDF')),
          h('li', 'Kantipur (11 Oct 2024). गुल्मीको टिमुरे तालमा बढ्दै आन्तरिक पर्यटक. ', ext('https://ekantipur.com/lumbini-pradesh/2024/10/11/domestic-tourists-growing-at-timure-lake-in-gulmi-10-21.html', 'Article')),
          h('li', 'Gorkhapatra (2025). सुक्दै पर्यटकीय टिमुरे ताल. ', ext('https://gorkhapatraonline.com/news/152377', 'Article')),
          h('li', 'Wilson & Richards (2006). Bathymetric maps and area/capacity tables for small reservoirs. USGS SIR 2006-5208. ', ext('https://www.usgs.gov/publications/procedural-documentation-and-accuracy-assessment-bathymetric-maps-and-areacapacity', 'USGS')),
          h('li', 'Rosenberry, Duque & Lee (2020). History and evolution of seepage meters, Part 1. Earth-Science Reviews. ', ext('https://www.usgs.gov/publications/history-and-evolution-seepage-meters-quantifying-flow-between-groundwater-and-surface', 'USGS')),
          h('li', 'Winter & Rosenberry (2009). Evaluation of methods and uncertainties in the water budget. ', ext('https://www.usgs.gov/publications/evaluation-methods-and-uncertainties-water-budget', 'USGS')),
          h('li', 'LaBaugh et al. (1997). Water balance of a closed-basin lake, north-central Minnesota. ', ext('https://www.usgs.gov/publications/hydrological-and-chemical-estimates-water-balance-a-closed-basin-lake-north-central', 'USGS')),
          h('li', 'USDA NRCS. Pond Sealing or Lining — Compacted Soil Treatment (Code 520). ', ext('https://www.nrcs.usda.gov/sites/default/files/2022-09/Pond_Sealing-Liner-Compacted-Soil-520-CPS-May-2016.pdf', 'PDF')),
          h('li', 'ICIMOD-related community assessment of springs and ponds, Kavre (2025–2026). ', ext('https://lib.icimod.org/records/y180m-a3x25', 'ICIMOD')),
          h('li', 'Thapa et al. (2023). Drying of springs in the Himalayan region of Nepal. Mountain Research and Development. ', ext('https://doi.org/10.1659/mrd.2023.00007', 'DOI')),
          h('li', 'GEOINFRA Research Institute (2025). Seepage control through Rankbang Lake, Kotgaun, Rolpa. ', ext('https://geoinfra.com.np/detail-study-for-seepage-control-through-the-rankbang-lake-kotgaun-rolpa/', 'GEOINFRA')),
          h('li', 'US Bureau of Reclamation. Engineering Geology Field Manual. ', ext('https://www.usbr.gov/tsc/techreferences/mands/geologyfieldmanual.html', 'USBR'))),
        h('p.muted.sm', { text: 'Map reference layer: lake outline, road and path © OpenStreetMap contributors (ODbL). Satellite imagery © Esri and partners.' })),
    );
  };
})();
