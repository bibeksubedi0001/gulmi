/* Timure & Chhekmi lakes field portal: shared option lists and schema helpers. */
'use strict';
(function () {
  const TT = window.TT;
  const o = (v, ne, en) => ({ v, ne, en });
  const O = (TT.O = {});

  // Chhekmi's centre is not in any inventory or map; the team sets it by GPS on its field day (Data page).
  TT.LAKES = {
    timure: { id: 'timure', code: 'TT', ne: 'टिमुरे ताल', en: 'Timure Taal', lat: 28.10051389, lon: 83.37936389, place: 'Chandrakot RM-4, Remi, Gulmi' },
    chhekmi: { id: 'chhekmi', code: 'CK', ne: 'छेक्मी ताल', en: 'Chhekmi Taal', lat: null, lon: null, place: 'Chekmi, Resunga-6, Gulmi' },
  };
  TT.LAKE_IDS = Object.keys(TT.LAKES);
  TT.lakeName = (id, lang = 'en') => (TT.LAKES[id] ? TT.Ls(TT.LAKES[id], lang) : id === 'both' ? 'Both lakes' : '');
  TT.lakeCode = (id) => (TT.LAKES[id] ? TT.LAKES[id].code : '');
  TT.lakeCentre = (id) => {
    const set = TT.settings && TT.settings.lakeCentres && TT.settings.lakeCentres[id];
    if (set && Number.isFinite(set.lat)) return { ...set, custom: true };
    const lk = TT.LAKES[id];
    return lk && Number.isFinite(lk.lat) ? { lat: lk.lat, lon: lk.lon } : null;
  };
  O.lake = TT.LAKE_IDS.map((id) => o(id, TT.LAKES[id].ne, TT.LAKES[id].en));
  O.lakeBoth = [...O.lake, o('both', 'दुवै ताल', 'Both lakes')];

  TT.TEAM = ['Bibek', 'Mission', 'Amrit'];
  O.team = [...TT.TEAM.map((name) => ({ v: name, en: name })), o('other', 'अन्य', 'Other')];
  TT.defaultTeam = (ctx) => {
    const t = ctx.settings.team;
    if (Array.isArray(t) && t.length) return [...t];
    return ctx.settings.enumerator ? [ctx.settings.enumerator] : '';
  };
  // Readable name(s) of a person/people field, resolving "Other".
  TT.personText = (vals, id) => {
    const v = vals[id], other = vals[id + '__other'];
    const one = (x) => (x === 'other' ? other || '' : x);
    return Array.isArray(v) ? v.map(one).filter(Boolean).join(', ') : v ? one(v) : '';
  };

  O.yn = [o('yes', 'हो', 'Yes'), o('no', 'होइन', 'No')];
  O.ynd = [...O.yn, o('dk', 'थाहा छैन', "Don't know")];
  O.ynna = [...O.ynd, o('na', 'लागू हुँदैन', 'Not applicable')];

  // Every key historical claim is tagged with how the respondent knows it.
  O.src = [
    o('seen', 'आफैँले देखेको', 'Seen myself'),
    o('heard', 'अरूबाट सुनेको', 'Heard from others'),
    o('both', 'दुवै', 'Both'),
    o('unsure', 'निश्चित छैन', 'Not sure'),
  ];

  O.dir = [
    o('N', 'उत्तर', 'North'), o('NE', 'उत्तर-पूर्व', 'North-east'), o('E', 'पूर्व', 'East'), o('SE', 'दक्षिण-पूर्व', 'South-east'),
    o('S', 'दक्षिण', 'South'), o('SW', 'दक्षिण-पश्चिम', 'South-west'), o('W', 'पश्चिम', 'West'), o('NW', 'उत्तर-पश्चिम', 'North-west'),
  ];
  O.dirDk = [...O.dir, o('dk', 'थाहा छैन', "Don't know")];

  O.months = [
    o('1', 'बैशाख', 'Baisakh (Apr–May)'), o('2', 'जेठ', 'Jestha (May–Jun)'), o('3', 'असार', 'Asar (Jun–Jul)'),
    o('4', 'साउन', 'Shrawan (Jul–Aug)'), o('5', 'भदौ', 'Bhadra (Aug–Sep)'), o('6', 'असोज', 'Asoj (Sep–Oct)'),
    o('7', 'कात्तिक', 'Kartik (Oct–Nov)'), o('8', 'मंसिर', 'Mangsir (Nov–Dec)'), o('9', 'पुस', 'Poush (Dec–Jan)'),
    o('10', 'माघ', 'Magh (Jan–Feb)'), o('11', 'फागुन', 'Falgun (Feb–Mar)'), o('12', 'चैत', 'Chaitra (Mar–Apr)'),
  ];

  // Lake water condition scale used in the year timeline and seasonal calendar (5 = full).
  O.level5 = [
    o('5', '५ भरिएको / सामान्य', '5 Full / normal'),
    o('4', '४ अलि कम', '4 Slightly low'),
    o('3', '३ स्पष्ट रूपमा कम', '3 Clearly low'),
    o('2', '२ धेरै कम', '2 Very low'),
    o('1', '१ लगभग / पूरै सुकेको', '1 Almost or fully dry'),
    o('dk', 'सम्झना छैन', "Don't remember"),
  ];

  O.change5 = [
    o('much_more', 'धेरै बढेको', 'Much more'), o('more', 'बढेको', 'More'), o('same', 'उस्तै', 'About the same'),
    o('less', 'घटेको', 'Less'), o('much_less', 'धेरै घटेको', 'Much less'), o('dk', 'थाहा छैन', "Don't know"),
  ];
  O.trend = [o('up', 'बढेको', 'Increased'), o('same', 'परिवर्तन छैन', 'No change'), o('down', 'घटेको', 'Decreased'), o('gone', 'हराएको', 'Disappeared'), o('dk', 'थाहा छैन', "Don't know")];

  O.freq = [
    o('daily', 'दैनिक', 'Daily'), o('weekly', 'हप्तामा कम्तीमा एक पटक', 'At least weekly'), o('monthly', 'महिनामा एक-दुई पटक', 'Monthly'),
    o('yearly', 'वर्षमा केही पटक', 'A few times a year'), o('rarely', 'कहिलेकाहीँ मात्र', 'Rarely'), o('never', 'कहिल्यै होइन', 'Never'),
  ];

  O.causes = [
    o('eq', 'भूकम्प (२०७२) पछिको परिवर्तन', '2015 (2072) earthquake effects'),
    o('rain', 'वर्षा घटेको / खडेरी', 'Less rainfall / drought'),
    o('concrete', 'कंक्रिट / किनार निर्माण कार्य', 'Concrete / edge works'),
    o('road', 'सडक वा नालीले पानीको बाटो बदलेको', 'Road / drain changed water paths'),
    o('seepage', 'पिँध वा किनारबाट चुहावट', 'Seepage through bed or banks'),
    o('sediment', 'गेग्रान / माटोले पुरिँदै गएको', 'Sediment infilling'),
    o('use', 'पानी निकासी / बढी प्रयोग', 'Water extraction / use'),
    o('veg', 'वनस्पति / वृक्षारोपण परिवर्तन', 'Vegetation / plantation change'),
    o('livestock', 'भैंसी/पशु आहाल नबस्ने भएपछि पिँध नलिपिएको', 'Fewer buffalo wallowing (bed no longer sealed)'),
    o('maint', 'परम्परागत सरसफाइ/मर्मत छोडिएको', 'Traditional maintenance stopped'),
    o('recharge', 'माथि बनाइएका पोखरी/खाल्डाले पानी रोकेको', 'Upslope ponds/trenches holding back runoff'),
    o('tourism', 'पर्यटन पूर्वाधार निर्माण', 'Tourism construction'),
    o('heat', 'गर्मी/बाष्पीकरण बढेको', 'Higher heat / evaporation'),
    o('other', 'अन्य', 'Other'),
  ];
  O.causeRate = [o('main', 'मुख्य कारण', 'Main cause'), o('contrib', 'सहायक कारण', 'Contributing'), o('unlikely', 'सम्भावना कम', 'Unlikely'), o('dk', 'थाहा छैन', "Don't know")];

  O.agency = [
    o('ward', 'वडा कार्यालय', 'Ward office'), o('rm', 'गाउँपालिका', 'Rural municipality'), o('province', 'प्रदेश सरकार', 'Provincial government'),
    o('forest', 'डिभिजन वन कार्यालय / भू-संरक्षण', 'Division Forest Office / soil conservation'), o('federal', 'संघीय निकाय', 'Federal agency'),
    o('cfug', 'सामुदायिक वन उपभोक्ता समूह', 'Community forest user group'), o('committee', 'ताल संरक्षण/उपभोक्ता समिति', 'Lake/user committee'),
    o('homestay', 'होमस्टे / पर्यटन समिति', 'Homestay / tourism committee'), o('ngo', 'गैरसरकारी संस्था / परियोजना', 'NGO / project'),
    o('community', 'स्थानीय समुदाय आफैँ', 'Community itself'), o('dk', 'थाहा छैन', "Don't know"), o('other', 'अन्य', 'Other'),
  ];

  O.weather = [o('sun', 'घमाइलो', 'Sunny'), o('cloud', 'बादल', 'Cloudy'), o('fog', 'कुहिरो', 'Fog'), o('drizzle', 'सिमसिम पानी', 'Drizzle'), o('rain', 'पानी परिरहेको', 'Raining'), o('storm', 'हावाहुरी/मुसलधारे', 'Storm / heavy rain')];
  O.rainSince = [o('none', 'परेन', 'None'), o('light', 'हल्का', 'Light'), o('moderate', 'मध्यम', 'Moderate'), o('heavy', 'भारी', 'Heavy'), o('dk', 'थाहा छैन', 'Unknown')];
  O.flowState = [o('dry', 'सुक्खा', 'Dry'), o('damp', 'ओसिलो', 'Damp only'), o('trickle', 'थोपा/सानो धारा', 'Trickle'), o('flowing', 'बगिरहेको', 'Flowing'), o('ponded', 'जमेको (नबगेको)', 'Ponded, not flowing')];
  O.cond5 = [{ v: '5', en: '5 Very good' }, { v: '4', en: '4 Good' }, { v: '3', en: '3 Fair' }, { v: '2', en: '2 Poor' }, { v: '1', en: '1 Very poor / failed' }];
  O.quality = [o('good', 'राम्रो', 'Good'), o('fair', 'ठिकै', 'Fair'), o('poor', 'कमजोर', 'Poor')];
  O.relLake = [o('inside', 'तालभित्र', 'Inside lake'), o('edge', 'किनारमा', 'At edge'), o('up', 'माथिपट्टि (upslope)', 'Upslope'), o('down', 'तलपट्टि (downslope)', 'Downslope'), o('side', 'छेउमा, उही उचाइ', 'Beside, same level')];

  // BS years newest first, with the AD span shown so both calendars are recorded.
  TT.bsYears = (from, to) => {
    const out = [];
    for (let y = from; y >= to; y--) out.push({ v: String(y), ne: TT.neDigits(y) + ` (${y - 57}/${String(y - 56).slice(-2)})`, en: TT.bsLabel(y) });
    return out;
  };

  // Memory anchors shown beside the year timeline (dates verified to year level).
  TT.ANCHORS = {
    2063: { ne: 'जनआन्दोलन / शान्ति सम्झौता', en: 'People’s movement / peace accord (2006)' },
    2068: { ne: 'जनगणना २०६८', en: 'National census (2011)' },
    2072: { ne: 'वैशाख १२ को भूकम्प; असोजमा संविधान जारी', en: 'Gorkha earthquake, 25 Apr 2015; constitution, Sep 2015' },
    2074: { ne: 'पहिलो स्थानीय निर्वाचन', en: 'First local elections (2017)' },
    2076: { ne: 'चैतमा कोभिड लकडाउन सुरु', en: 'COVID lockdown from Mar 2020' },
    2078: { ne: 'जनगणना २०७८', en: 'National census (2021)' },
    2079: { ne: 'स्थानीय निर्वाचन', en: 'Local elections (2022)' },
    2080: { ne: 'कात्तिकमा जाजरकोट भूकम्प', en: 'Jajarkot earthquake (Nov 2023)' },
  };

  // Grid rows for the year-by-year water condition timeline (BS with AD span; digits read the same in both languages).
  TT.yearRows = (from, to) => {
    const rows = [];
    for (let y = from; y <= to; y++) rows.push({ v: String(y), en: TT.bsLabel(y), note: TT.ANCHORS[y] });
    return rows;
  };

  // Hypotheses H1-H8 exactly as framed in the field study report (section 2.3 / 16).
  TT.HYP = [
    { id: 'H1', en: 'Reduced catchment recharge', ne: 'जलाधारबाट पुनर्भरण घटेको',
      test: 'Rainfall/runoff no longer reaches the lake as effectively because of changed drainage, roads, vegetation, recharge structures, or altered micro-catchment.',
      sup: 'Mapped former inflow now blocked; road drains bypass lake; change after construction; reduced effective catchment.',
      weak: 'Active inflows remain unchanged; no drainage diversion.' },
    { id: 'H2', en: 'Concrete/edge works intercepted inflow', ne: 'कंक्रिट/किनार निर्माणले आगमन रोकेको',
      test: 'Lining or perimeter construction may have blocked diffuse overland or shallow lateral inflow that previously entered through natural soil/low points.',
      sup: 'Physical blocking of old swales/lateral pathways; timing matches decline; outside water ponds against raised edge.',
      weak: 'Decline clearly predates lining; lining does not intersect inflow paths.' },
    { id: 'H3', en: 'Increased subsurface leakage', ne: 'जमिनमुनिबाट चुहावट बढेको',
      test: 'Lake-bed, bank or foundation permeability may have increased, or new preferential seepage paths may exist through cracks, joints, disturbed fill or bedrock.',
      sup: 'Persistent downslope wet zone/spring, rapid stage recession, seepage-meter flux, ERT anomaly, permeable/faulted subgrade.',
      weak: 'No seepage evidence; lake level tracks rainfall/evaporation closely.' },
    { id: 'H4', en: 'Earthquake-related hydrogeological change', ne: 'भूकम्पपछि जमिनमुनिको जलप्रणाली परिवर्तन',
      test: 'The 2015 earthquake may have altered fractures, shallow groundwater pathways, bank/lake-bed condition or local springs. Timing alone is not proof.',
      sup: 'Documented cracks/land deformation or spring change immediately after 2015; independent witnesses; subsurface evidence.',
      weak: 'Only retrospective attribution with no physical/timing evidence.' },
    { id: 'H5', en: 'Climate / seasonality', ne: 'जलवायु / मौसम परिवर्तन',
      test: 'Longer dry spells, rainfall variability and evaporation may have shifted the annual water balance.',
      sup: 'Long-term rainfall deficit/longer dry spells coincide with level decline; similar nearby sources affected.',
      weak: 'Rainfall remains comparable while lake alone declines.' },
    { id: 'H6', en: 'Sedimentation / morphology change', ne: 'गेग्रान / आकार परिवर्तन',
      test: 'Sediment deposition, excavation, cleaning or reshaping may have reduced effective storage or altered inflow routing.',
      sup: 'Bathymetry/cores show major infilling; high sediment fans; reduced depth but similar water-surface level.',
      weak: 'No meaningful sediment accumulation.' },
    { id: 'H7', en: 'Human use / management change', ne: 'मानवीय प्रयोग / व्यवस्थापन परिवर्तन',
      test: 'Water withdrawal, drainage modification, tourism works, livestock change, vegetation or maintenance practices may contribute.',
      sup: 'Pumping, diversion, changed outlet, tourism/road works or loss of traditional bed sealing directly alter the balance.',
      weak: 'No significant withdrawals or hydraulic modifications.' },
    { id: 'H8', en: 'Combined causes', ne: 'संयुक्त कारणहरू',
      test: 'Several small changes may together explain the observed decline better than any single cause.',
      sup: 'Two or more mechanisms each have moderate support and their timing overlaps the decline.',
      weak: 'One mechanism alone explains the measured losses.' },
  ];

  // `show: [fieldId, value|values]` is the declarative skip rule; it also prints as "Ask if ...".
  function compileShow(x) {
    if (!x.show || x.showIf) return;
    const [dep, want] = x.show;
    const set = (Array.isArray(want) ? want : [want]).map(String);
    x.showIf = (v) => {
      const cur = v[dep];
      return Array.isArray(cur) ? cur.some((c) => set.includes(String(c))) : cur != null && set.includes(String(cur));
    };
    x._dep = [dep, set];
  }
  const DK_YEAR = { v: 'dk', ne: 'थाहा छैन / सम्झना छैन', en: "Don't know" };
  function normalize(f) {
    if (f.type === 'yn' && !f.options) f.options = f.dk === false ? O.yn : f.na ? O.ynna : O.ynd;
    if (f.type === 'bsyear' && !f.options) f.options = [...TT.bsYears(f.from || TT.bsYearOf(), f.to || 2000), DK_YEAR];
    if (f.type === 'months' && !f.options) f.options = O.months;
    if (f.type === 'person' || f.type === 'people') { f.options = O.team; f.other = true; }
    if (f.type === 'table') f.columns.forEach(normalize);
    compileShow(f);
  }

  // Prepare a form once: lake field, numbering, flat field list, lookup map.
  TT.prepareForm = function (form) {
    if (form._ready) return form;
    form.sections[0].fields.unshift({
      id: 'lake', type: 'select', q: { ne: 'ताल', en: 'Lake' }, required: true, note: false,
      options: form.lakeBoth ? O.lakeBoth : O.lake, default: (ctx) => ctx.settings.activeLake || '',
    });
    form.fields = [];
    form.fieldMap = {};
    form.sections.forEach((sec, si) => {
      let n = 0;
      sec.index = si;
      compileShow(sec);
      sec.fields.forEach((f) => {
        f.section = sec;
        normalize(f);
        if (f.type !== 'info') {
          n++;
          f.num = sec.id + (/\d$/.test(sec.id) ? '.' : '') + n;
        }
        form.fields.push(f);
        form.fieldMap[f.id] = f;
      });
    });
    form._ready = true;
    return form;
  };

  TT.FORMS = TT.FORMS || {};
  TT.FORM_ORDER = TT.FORM_ORDER || [];
  TT.registerForm = function (form) {
    TT.prepareForm(form);
    TT.FORMS[form.id] = form;
    TT.FORM_ORDER.push(form.id);
  };
})();
