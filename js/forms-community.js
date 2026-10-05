/* Lakes field portal: community interviews (English). HH ~20-minute household interview; KII key-informant interview. */
'use strict';
(function () {
  const TT = window.TT;
  const O = TT.O;
  const e = (en) => ({ en });
  const op = (v, en) => ({ v, en });
  const F = (id, type, q, x = {}) => ({ id, type, q: { en: q }, ...x });
  const C = (id, type, label, x = {}) => ({ id, type, label: { en: label }, ...x });
  const dk = op('dk', "Don't know");
  const other = op('other', 'Other');
  const enumerator = () => F('enum', 'person', 'Enumerator', { default: (ctx) => ctx.settings.enumerator || '' });
  const settlements = (v, ctx) => [...new Set((ctx.records || []).filter((r) => r.form === 'hh' && r.data.lake === v.lake && r.data.settlement).map((r) => r.data.settlement))];
  const LINING = ['concrete', 'wall', 'bed'];

  TT.registerForm({
    id: 'hh', short: 'HH', version: 2, group: 'community', icon: 'users', geo: 'loc', target: 8, targetLabel: 'interviews',
    title: e('Household interview'),
    summary: (v) => [v.settlement, v.age ? v.age + ' y' : '', { f: 'F', m: 'M', o: 'O' }[v.gender] || '', v.years_here != null ? v.years_here + ' yrs here' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: 'A', title: e('Interview'), fields: [
        enumerator(),
        F('start', 'datetime', 'Date & time', { now: true }),
        F('loc', 'gps', 'Interview location'),
        F('settlement', 'text', 'Settlement / tole', { suggest: settlements }),
        F('consent', 'yn', 'Consent given?', { dk: false }),
      ] },
      { id: 'B', title: e('Respondent'), show: ['consent', 'yes'], fields: [
        F('gender', 'select', 'Gender', { options: [op('f', 'Female'), op('m', 'Male'), op('o', 'Other')] }),
        F('age', 'integer', 'Age', { unit: 'years', min: 15, max: 110 }),
        F('years_here', 'integer', 'Years living in this area', { min: 0, max: 110, ref: 2 }),
        F('relation', 'checks', 'Relationship with the lake', { ref: 3, other: true, options: [
          op('resident', 'Lives nearby'), op('farmer', 'Farmer / herder'), op('tourism', 'Homestay / tourism'),
          op('committee', 'Committee / local representative'), op('worker', 'Worked on lake construction'), other] }),
      ] },
      { id: 'C', title: e('Lake history and decline'), show: ['consent', 'yes'],
        fields: [
          F('yearround_then', 'select', 'In the past, did the lake keep water through the dry season?', { ref: 7, evidence: true, options: [
            op('full', 'Always stayed full'), op('some', 'Always kept some water'), op('some_years', 'Dried in some years'), op('every_year', 'Dried every year'), dk] }),
          F('old_depth', 'number', 'Past maximum depth (estimate)', { unit: 'm', min: 0, max: 30, ref: 9 }),
          F('old_shore', 'textarea', 'Where did the old high-water edge reach? (landmark)', { ref: 8, evidence: true }),
          F('noticed', 'yn', 'Has the water level been declining?'),
          F('first_noticed', 'bsyear', 'Year the decline was first clearly noticed', { show: ['noticed', 'yes'], evidence: true, to: 2030, ref: 12 }),
          F('pattern', 'select', 'Was the change sudden or gradual?', { show: ['noticed', 'yes'], ref: 13, options: [
            op('sudden', 'Sudden (within a season)'), op('gradual', 'Gradual over years'), op('sudden_then_gradual', 'Sudden, then gradual'), op('fluctuating', 'Up and down'), dk] }),
          F('own_words', 'textarea', 'What changed, and why? (their own words)', { show: ['noticed', 'yes'] }),
          F('levels', 'grid', 'Dry-season water level in each period', { levelColors: true, scale: O.level5,
            cols: [op('dry', 'Dry season (Chaitra–Jestha)')],
            rows: [op('pre', 'Before 2072 BS (2015)'), op('mid', '2072–2079 BS (2015–2022)'), op('now', 'Last two years')] }),
          F('lo_months_now', 'months', 'Months of lowest water now', { ref: 16 }),
          F('dried_fully', 'yn', 'Did the lake dry completely in the last 12 months?'),
        ] },
      { id: 'D', title: e('Water in and out'), show: ['consent', 'yes'], fields: [
        F('src_where', 'checks', 'Where does the lake water come from?', { ref: 23, options: [
          op('rain', 'Rain on the lake'), op('runoff', 'Runoff from slopes'), op('gully', 'Gully / channel'), op('spring', 'Spring'),
          op('ground', 'Underground'), op('road', 'Road drain'), op('pipe', 'Pipe / diversion'), dk] }),
        F('runoff_dir', 'checks', 'From which direction does most rainwater come?', { ref: 24, options: O.dirDk }),
        F('path_closed', 'yn', 'Is an old inflow path now blocked or reduced?', { ref: 25, evidence: true }),
        F('path_closed_by', 'checks', 'Blocked by', { show: ['path_closed', 'yes'], other: true, options: [
          op('road', 'Road'), op('concrete', 'Concrete edge / wall'), op('fill', 'Soil fill'), op('plants', 'Vegetation / plantation'),
          op('house', 'House / structure'), op('rpond', 'Recharge pond / trench'), other] }),
        F('outlet', 'select', 'Is there an outlet, overflow or drain?', { ref: 38, options: [op('now', 'Yes, now'), op('past', 'Only in the past'), op('never', 'Never'), dk] }),
        F('down_wet', 'yn', 'Is there wet ground, seepage or a spring below the lake?', { ref: 41, evidence: true }),
        F('other_sources', 'select', 'Have other springs or taps in the village also declined?', {
          options: [op('many', 'Many declined'), op('some', 'Some declined'), op('no', 'Not declined'), dk] }),
      ] },
      { id: 'E', title: e('Works, earthquake and use'), show: ['consent', 'yes'], fields: [
        F('works', 'checks', 'Works done at or around the lake', { ref: 29, other: true, options: [
          op('concrete', 'Concrete edge lining'), op('wall', 'Wall / embankment'), op('bed', 'Bed lining'), op('dig', 'Deepening / de-silting'),
          op('road', 'Road / drain nearby'), op('rpond', 'Recharge ponds upslope'), op('plant', 'Plantation'), op('none', 'None'), dk, other] }),
        F('con_year', 'bsyear', 'Year of the concrete / edge work', { show: ['works', LINING], ref: 29 }),
        F('con_after', 'select', 'After that work, the water level…', { show: ['works', LINING], ref: 32, options: [
          op('drop_now', 'Dropped soon after'), op('drop_later', 'Dropped some years later'), op('no_change', 'No change'),
          op('better', 'Improved'), op('before', 'Decline had already started'), dk] }),
        F('con_closed', 'yn', 'Did the works block natural inflow paths or soil edges?', { show: ['works', LINING], ref: 33, evidence: true }),
        F('eq_change', 'select', 'Change in the lake after the 2072 BS (2015) earthquake?', { ref: 17, evidence: true, options: [
          op('down', 'Water decreased'), op('up', 'Water increased'), op('none', 'No change'), dk] }),
        F('eq_signs', 'checks', 'Seen after the earthquake', { ref: 19, options: [
          op('cracks', 'Cracks in ground / lake edge'), op('subsidence', 'Ground sinking'), op('landslide', 'Landslide'),
          op('new_spring', 'New spring'), op('spring_dried', 'Spring dried'), op('none', 'Nothing seen'), dk] }),
        F('wallow', 'select', 'Do buffaloes wallow in the lake?', { options: [
          op('stopped', 'Used to, not any more'), op('still', 'Still do'), op('never', 'Never did'), dk] }),
        F('extraction', 'yn', 'Is water pumped or taken from the lake?', { ref: 56 }),
      ] },
      { id: 'F', title: e('Causes and closing'), show: ['consent', 'yes'], fields: [
        F('cause_rank', 'rank', 'Three most likely causes', { ref: 61, max: 3, options: O.causes }),
        F('cause_evidence', 'textarea', 'Strongest evidence for the first cause', { ref: 63, evidence: true }),
        F('action', 'textarea', 'What should be done first to save the lake?', { ref: 65 }),
        F('gauge_reader', 'yn', 'Willing to read a water-level gauge weekly and send a photo?', { dk: false }),
        F('phone', 'text', 'Phone number', { pii: true, show: ['gauge_reader', 'yes'] }),
        F('photos', 'photos', 'Photos'),
        F('reliability', 'select', 'Respondent reliability (your judgement)', { options: [op('high', 'High'), op('medium', 'Medium'), op('low', 'Low')] }),
        F('notes', 'textarea', 'Key quotes and follow-up'),
      ] },
    ],
  });

  TT.registerForm({
    id: 'kii', short: 'KII', version: 2, group: 'community', icon: 'message', geo: 'loc', target: 2, targetLabel: 'interviews',
    title: e('Key-informant interview'),
    summary: (v) => [TT.optLabel(TT.FORMS.kii.fieldMap.role, v.role || ''), v.org].filter(Boolean).join(' · '),
    sections: [
      { id: 'A', title: e('Interview'), fields: [
        enumerator(),
        F('start', 'datetime', 'Date & time', { now: true }),
        F('loc', 'gps', 'Location'),
        F('consent', 'yn', 'Consent given?', { dk: false }),
        F('role', 'select', 'Informant', { other: true, show: ['consent', 'yes'], options: [
          op('ward', 'Ward chair / member'), op('rm', 'Municipal official / engineer'), op('forest', 'Forest / soil conservation office'),
          op('contractor', 'Contractor / mason'), op('committee', 'Lake / user committee'), op('homestay', 'Homestay / tourism'),
          op('elder', 'Elder / long-term resident'), other] }),
        F('org', 'text', 'Organisation / position', { show: ['consent', 'yes'] }),
        F('name', 'text', 'Name (optional)', { pii: true, show: ['consent', 'yes'] }),
      ] },
      { id: 'B', title: e('Questions'), show: ['consent', 'yes'], fields: [
        F('k_timeline', 'textarea', 'Major changes to the lake from before 2072 BS to now (with years)', { ref: 1, evidence: true }),
        F('k_works', 'table', 'Works at the lake', { ref: 2, minRows: 2, printRows: 5, columns: [
          C('work', 'text', 'Work'), C('year', 'bsyear', 'Year (BS)', { to: 2030 }), C('agency', 'text', 'Agency / contractor'),
          C('docs', 'select', 'Documents', { options: [op('drawings', 'Drawings / BOQ'), op('report', 'Report'), op('none', 'None'), dk] })] }),
        F('k_lining', 'textarea', 'Why was the lining built? Were inflow paths, springs or wet soil seen while digging?', { ref: 4, evidence: true }),
        F('k_outlet', 'textarea', 'Was any outlet or overflow built, closed, raised or repaired?', { ref: 6 }),
        F('k_eq', 'textarea', 'Did the 2072 earthquake damage the lake area? Were cracks repaired?', { ref: 7, evidence: true }),
        F('k_records', 'textarea', 'Any survey, water-level, rainfall or maintenance records? Who holds them?', { ref: 9 }),
        F('k_priority', 'textarea', 'What should be studied or done first, and why?', { ref: 12 }),
        F('docs_photos', 'photos', 'Photos of documents / old photos'),
      ] },
    ],
  });
})();
