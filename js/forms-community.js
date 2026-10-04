/* Timure Taal field portal: community questionnaires (bilingual Nepali / English).
 * HH   household & community questionnaire (all 65 report questions, tagged R1-R65, plus livelihood/ecology additions)
 * KII  key-informant interview guide (report section 14, expanded)
 * FGD  focus-group discussion with participatory exercises
 * EV   historical evidence register (old photos, documents, news, drawings)
 */
'use strict';
(function () {
  const TT = window.TT;
  const O = TT.O;
  const t = (ne, en) => (en === undefined ? { en: ne } : { ne, en });
  const op = (v, ne, en) => ({ v, ne, en });
  const F = (id, type, q, x = {}) => ({ id, type, q, ...x });
  const dk = op('dk', 'थाहा छैन', "Don't know");
  const other = op('other', 'अन्य', 'Other');
  const nowYear = TT.bsYearOf();

  const fromRecords = (form, key) => (v, ctx) => [...new Set((ctx.records || []).filter((r) => r.form === form && r.data[key]).map((r) => String(r.data[key])))].slice(0, 40);
  const notIn = (key, bad) => (v) => Array.isArray(v[key]) && v[key].some((x) => !bad.includes(x));

  const ENUM_NOTE = t(
    'प्रश्नहरू तटस्थ रूपमा सोध्नुहोस्। उत्तरदाताले के देखेका छन् भनेर सोध्नुअघि भूकम्प वा कंक्रिट lining नै कारण हो भनेर नभन्नुहोस्। साल वि.सं.मा लेख्नुहोस् (ई.सं. आफैँ देखिन्छ)। पुरानो पानीको सतह अनुमान गर्दा ढुंगा, रुख, बाटो जस्ता चिनारी वा फोटो माग्नुहोस्। हरेक मुख्य दाबीमा सोध्नुहोस्: “पहिलो पटक कहिले थाहा पाउनुभयो?”, “के भौतिक प्रमाण सम्झनुहुन्छ?”, “अरू कसले पुष्टि गर्न सक्छ?” — र आफैँ देखेको हो कि सुनेको हो, छुट्याउनुहोस्।',
    'Administer neutrally. Do not suggest that the earthquake or the concrete lining is the cause before asking what the respondent observed. Record years in BS (AD is shown automatically). Ask for physical landmarks or photos whenever historical water level is estimated. For each major claim ask: “When did you first notice this?”, “What physical evidence do you remember?”, “Who else can verify it?” — and tag whether it was seen or heard.');

  const CONSENT = t(
    'नमस्कार। मेरो नाम ____ हो। हामी टिमुरे तालको पानीको सतह किन घट्दै गएको हो भन्ने विषयमा प्रारम्भिक इन्जिनियरिङ अध्ययन गर्दैछौँ। तपाईंको अनुभव र सम्झनाले तालको इतिहास बुझ्न धेरै मद्दत गर्छ। यो कुराकानीमा करिब ४५–६० मिनेट लाग्न सक्छ। सहभागिता पूर्ण रूपमा स्वैच्छिक हो — तपाईं कुनै पनि प्रश्नको जवाफ नदिन वा जुनसुकै बेला रोक्न सक्नुहुन्छ। तपाईंको नाम र व्यक्तिगत विवरण गोप्य राखिनेछ; प्रतिवेदनमा नाम उल्लेख गरिने छैन। यहाँ सही वा गलत उत्तर हुँदैन — तपाईंले जे देख्नुभयो र सम्झनुहुन्छ, त्यही भन्नुहोस्। के तपाईं सहभागी हुन सहमत हुनुहुन्छ?',
    'Hello. My name is ____. We are carrying out a preliminary engineering study of why the water level of Timure Taal has been declining. Your experience and memories will help us understand the lake’s history. This takes about 45–60 minutes. Participation is voluntary — you may skip any question or stop at any time. Your name and personal details will be kept confidential and will not appear in any report. There are no right or wrong answers — please tell us what you have seen and remember. Do you agree to take part?');

  const meta = (extra = []) => [
    F('enum', 'text', t('सर्वेक्षकको नाम', 'Enumerator'), { required: true, default: (ctx) => ctx.settings.enumerator || '' }),
    F('start', 'datetime', t('सुरु मिति र समय', 'Start date & time'), { required: true, now: true }),
    F('loc', 'gps', t('अन्तर्वार्ता लिइएको स्थान (GPS)', 'Interview location (GPS)'), { hint: t('घर/आँगनबाहिर खुला ठाउँमा GPS लिनुहोस्।', 'Capture outdoors for a better fix.') }),
    ...extra,
  ];

  /* ======================= HH: household & community questionnaire ======================= */
  const relation = [
    op('resident', 'तालनजिकको बासिन्दा', 'Resident near the lake'), op('farmer', 'किसान', 'Farmer'), op('herder', 'पशुपालक / गोठालो', 'Livestock herder'),
    op('homestay', 'होमस्टे / पर्यटन व्यवसायी', 'Homestay / tourism'), op('rep', 'स्थानीय जनप्रतिनिधि', 'Local representative'),
    op('committee', 'ताल / वन / उपभोक्ता समिति सदस्य', 'Lake / forest / user committee member'), op('worker', 'ताल निर्माण कार्यमा संलग्न', 'Worked on lake construction'),
    op('teacher', 'शिक्षक / समाजसेवी', 'Teacher / social worker'), op('cultural', 'धार्मिक / सांस्कृतिक सम्बन्ध', 'Religious / cultural link'), other,
  ];

  TT.registerForm({
    id: 'hh', short: 'HH', version: 1, group: 'community', icon: 'users', geo: 'loc', target: 40, targetLabel: 'interviews',
    title: t('घरधुरी तथा समुदाय प्रश्नावली', 'Household & community questionnaire'),
    purpose: t('स्थानीय बासिन्दासँग तटस्थ, संरचित अन्तर्वार्ता — तालको इतिहास, पानी घटेको समयरेखा, पानी आउने/जाने बाटो, निर्माणको इतिहास र जीवनयापनमा परेको असर बुझ्न। फिल्ड प्रतिवेदनका सबै ६५ प्रश्न (R1–R65) समावेश छन्।',
      'Neutral, structured interview with residents to reconstruct the lake’s history, the timeline of decline, inflow and outflow paths, construction history and livelihood impacts. Covers all 65 questions of the field study report (tagged R1–R65).'),
    summary: (v) => [v.settlement, v.age ? v.age + ' y' : '', { f: 'F', m: 'M', o: 'O' }[v.gender] || '', v.years_here != null ? v.years_here + ' yrs here' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: 'A', title: t('अन्तर्वार्ता विवरण र सहमति', 'Interview details & consent'), fields: [
        F('i_enum', 'info', null, { text: ENUM_NOTE }),
        ...meta([
          F('ward', 'integer', t('वडा नं.', 'Ward no.'), { min: 1, max: 12 }),
          F('settlement', 'text', t('बस्ती / टोलको नाम', 'Settlement / tole'), { suggest: fromRecords('hh', 'settlement'), ph: 'e.g. Timure, Remi' }),
          F('dist_lake', 'radio', t('घरबाट तालसम्म हिँडेर लाग्ने समय', 'Walking time from home to the lake'), { options: [
            op('lt5', '५ मिनेटभन्दा कम', '< 5 min'), op('5_15', '५–१५ मिनेट', '5–15 min'), op('15_30', '१५–३० मिनेट', '15–30 min'), op('30_60', '३०–६० मिनेट', '30–60 min'), op('gt60', '१ घण्टाभन्दा बढी', '> 1 hour')] }),
          F('lang_int', 'radio', t('अन्तर्वार्ताको भाषा', 'Interview language'), { options: [op('ne', 'नेपाली', 'Nepali'), op('magar', 'मगर', 'Magar'), op('gurung', 'गुरुङ', 'Gurung'), other], other: true }),
          F('mode', 'radio', t('अन्तर्वार्ताको अवस्था', 'Interview setting'), { options: [op('alone', 'एक्लै', 'Respondent alone'), op('family', 'परिवारका सदस्य उपस्थित', 'Family members present'), op('group', 'सानो समूह', 'Small group')] }),
        ]),
        F('i_consent', 'info', null, { text: CONSENT }),
        F('consent', 'yn', t('उत्तरदाता सहभागी हुन सहमत हुनुहुन्छ?', 'Does the respondent agree to take part?'), { dk: false, required: true, hint: t('“होइन” भए अन्तर्वार्ता यहीँ अन्त्य गर्नुहोस् र रेकर्ड सेभ गर्नुहोस्।', 'If “No”, end here and save the record.') }),
        F('consent_photo', 'yn', t('देखाइएका ठाउँ र कागजातको फोटो खिच्न अनुमति?', 'Permission to photograph points and documents shown?'), { dk: false, show: ['consent', 'yes'] }),
        F('consent_contact', 'yn', t('पछि फेरि सम्पर्क गर्न अनुमति?', 'May we contact them again?'), { dk: false, show: ['consent', 'yes'] }),
      ] },

      { id: 'B', title: t('उत्तरदाताको विवरण', 'Respondent profile'), show: ['consent', 'yes'], fields: [
        F('name', 'text', t('उत्तरदाताको नाम (ऐच्छिक)', 'Respondent name (optional)'), { pii: true, ref: 1 }),
        F('phone', 'text', t('फोन नम्बर', 'Phone number'), { pii: true, show: ['consent_contact', 'yes'] }),
        F('age', 'integer', t('उमेर (वर्ष)', 'Age (years)'), { min: 15, max: 110, ref: 1 }),
        F('gender', 'radio', t('लिङ्ग', 'Gender'), { ref: 1, options: [op('f', 'महिला', 'Female'), op('m', 'पुरुष', 'Male'), op('o', 'अन्य', 'Other'), op('x', 'भन्न नचाहने', 'Prefer not to say')] }),
        F('occupation', 'checks', t('मुख्य पेशा (एकभन्दा बढी हुन सक्छ)', 'Main occupation (multiple allowed)'), { ref: 1, other: true, options: [
          op('agri', 'कृषि', 'Farming'), op('livestock', 'पशुपालन', 'Livestock'), op('tourism', 'होमस्टे / पर्यटन', 'Homestay / tourism'), op('business', 'व्यापार / पसल', 'Business / shop'),
          op('service', 'सरकारी सेवा / शिक्षण', 'Government service / teaching'), op('labour', 'ज्याला / निर्माण मजदुरी', 'Wage / construction labour'),
          op('returnee', 'वैदेशिक रोजगारीबाट फर्केको', 'Returned migrant worker'), op('student', 'विद्यार्थी', 'Student'), op('home', 'घरायसी काम', 'Household work'), op('retired', 'अवकाशप्राप्त', 'Retired'), other] }),
        F('born_here', 'yn', t('यही क्षेत्रमा जन्मनुभएको हो?', 'Born in this area?'), { dk: false }),
        F('years_here', 'integer', t('यस क्षेत्रमा कुल कति वर्षदेखि बस्दै आउनुभएको छ?', 'How many years have you lived in this area?'), { min: 0, max: 110, ref: 2 }),
        F('since_year', 'bsyear', t('कुन सालदेखि यहाँ बस्न थाल्नुभयो?', 'Living here since which year?'), { show: ['born_here', 'no'], ref: 2 }),
        F('longterm', 'computed', t('लामो समयदेखिको बासिन्दा?', 'Long-term resident?'), {
          compute: (v) => (v.born_here === 'yes' || TT.num(v.years_here) >= 15 ? 'Yes — prioritise historical questions' : v.years_here != null ? 'No — treat historical answers mainly as hearsay unless directly observed' : null) }),
        F('relation', 'checks', t('तालसँग तपाईंको सम्बन्ध', 'Your relationship with the lake'), { ref: 3, other: true, options: relation }),
        F('visit_now', 'radio', t('अहिले तालमा कति पटक जानुहुन्छ?', 'How often do you visit the lake now?'), { ref: 4, options: O.freq }),
        F('visit_past', 'radio', t('२०७२ भन्दा अघि (वा १० वर्षअघि) कति पटक जानुहुन्थ्यो?', 'How often before 2072 BS (or 10+ years ago)?'), { ref: 4, options: O.freq }),
        F('hh_size', 'integer', t('परिवारका सदस्य संख्या', 'Household size (persons)'), { min: 1, max: 40 }),
        F('hh_uses', 'yn', t('तपाईंको परिवारले अहिले ताल प्रयोग गर्छ? (पानी, पशु, पर्यटन आम्दानी)', 'Does your household use the lake now (water, livestock, tourism income)?')),
        F('committee', 'yn', t('परिवारको कुनै सदस्य ताल/वन/होमस्टे/उपभोक्ता समितिमा हुनुहुन्छ?', 'Is any household member on a lake, forest, homestay or user committee?')),
      ] },

      { id: 'C', title: t('पहिलेको ताल', 'The lake in the past'), show: ['consent', 'yes'],
        intro: t('उत्तरदाताले स्पष्टसँग सम्झने सबैभन्दा पुरानो समयबारे सोध्नुहोस्। सकेसम्म चिनारी (ढुंगा, रुख, बाटो, पर्खाल) देखाउन भन्नुहोस्।', 'Ask about the earliest period the respondent remembers clearly. Ask them to point to landmarks (stone, tree, path, wall).'),
        fields: [
          F('earliest_year', 'bsyear', t('तालको सबैभन्दा पुरानो स्पष्ट सम्झना कुन सालको हो?', 'Year of your earliest clear memory of the lake'), { to: 1990 }),
          F('hist_desc', 'textarea', t('त्यो बेला ताल कस्तो थियो? आकार, गहिराइ र पानीको स्थायित्व वर्णन गर्नुहोस्।', 'What was the lake like then? Describe size, depth and how permanent the water was.'), { ref: 5, evidence: true }),
          F('size_then', 'radio', t('अहिलेको तुलनामा त्यो बेलाको तालको क्षेत्रफल', 'Compared with now, the lake area then was'), { options: [
            op('much', 'धेरै ठूलो (दोब्बरभन्दा बढी)', 'Much larger (more than double)'), op('larger', 'अलि ठूलो', 'Somewhat larger'), op('same', 'उस्तै', 'About the same'), op('smaller', 'सानो', 'Smaller'), dk] }),
          F('yearround_then', 'radio', t('पहिले सुक्खा मौसममा पनि पानी रहन्थ्यो कि ताल सुक्थ्यो?', 'In the dry season, did the lake keep water or dry up?'), { ref: 7, evidence: true, options: [
            op('full', 'सधैँ भरिएको रहन्थ्यो', 'Always stayed full'), op('some', 'सधैँ केही पानी रहन्थ्यो', 'Always kept some water'),
            op('some_years', 'कुनै-कुनै वर्ष सुक्थ्यो', 'Dried in some years'), op('every_year', 'हरेक वर्ष सुक्थ्यो', 'Dried every year'), dk] }),
          F('dried_detail', 'textarea', t('सुक्थ्यो भने कुन महिनामा र कति हदसम्म?', 'If it dried: in which months and how far?'), { ref: 7, show: ['yearround_then', ['some_years', 'every_year']] }),
          F('hi_months_then', 'months', t('पहिले सबैभन्दा धेरै पानी हुने महिना', 'Months of highest water then'), { ref: 6 }),
          F('lo_months_then', 'months', t('पहिले सबैभन्दा कम पानी हुने महिना', 'Months of lowest water then'), { ref: 6 }),
          F('old_shore', 'textarea', t('पहिले अधिकतम पानीको किनारा कहाँसम्म पुग्थ्यो? कुनै ढुंगा, रुख, बाटो, पर्खाल वा घरलाई चिनारी बनाएर भन्नुहोस्।', 'Where did the highest shoreline reach? Describe it using a stone, tree, path, wall or building as reference.'), { ref: 8, evidence: true }),
          F('old_shore_pt', 'gps', t('चिनारी देखाउनुभएमा: पुरानो किनाराको GPS', 'If shown on site: GPS at the old-shoreline landmark')),
          F('old_shore_photo', 'photos', t('पुरानो किनाराको चिनारीको फोटो', 'Photo of the old-shoreline landmark'), { show: ['consent_photo', 'yes'] }),
          F('old_depth', 'number', t('पहिलेको अनुमानित अधिकतम गहिराइ', 'Estimated past maximum depth'), { unit: 'm', min: 0, max: 30, ref: 9 }),
          F('old_depth_basis', 'radio', t('गहिराइको अनुमान केमा आधारित छ?', 'What is the depth estimate based on?'), { ref: 9, options: [
            op('swim', 'पौडी खेल्दा / भित्र पसेर', 'Swimming / wading'), op('pole', 'लट्ठी / बाँसले नापेको', 'Measured with a pole'),
            op('heard', 'अरूले भनेको', 'Others said so'), op('guess', 'अनुमान मात्र', 'Guess only')] }),
          F('old_depth_where', 'text', t('त्यो गहिराइ तालको कुन ठाउँमा थियो?', 'At which spot in the lake was that depth?'), { ref: 9 }),
          F('clarity_then', 'radio', t('पहिले पानी कस्तो देखिन्थ्यो?', 'What did the water look like then?'), { options: [
            op('clear', 'सफा / पारदर्शी', 'Clear'), op('green', 'हरियो', 'Greenish'), op('muddy', 'धमिलो / माटोयुक्त', 'Muddy'), dk] }),
          F('overflow_then', 'radio', t('पहिले वर्षामा ताल भरिएर पोखिन्थ्यो (overflow)?', 'Did the lake overflow in the monsoon then?'), { options: [
            op('every', 'हरेक वर्षा', 'Every monsoon'), op('some', 'कुनै-कुनै वर्ष', 'Some years'), op('never', 'कहिल्यै होइन', 'Never'), dk] }),
          F('old_photos', 'yn', t('तालको पुरानो फोटो / भिडियो (चाडपर्व, पिकनिक, डुङ्गा) उपलब्ध छ?', 'Are old photos/videos of the lake available (festivals, picnics, boating)?'), { ref: 10 }),
          F('old_photos_who', 'text', t('कोसँग छ? कुन सालको? (प्रमाण दर्ता फारममा अलग्गै दर्ता गर्नुहोस्)', 'Who holds them, from which year? (log each in the Evidence register)'), { show: ['old_photos', 'yes'], pii: true }),
          F('uses_then', 'checks', t('पहिले तालको पानी के-के काममा प्रयोग हुन्थ्यो?', 'What was the lake water used for in the past?'), { ref: 11, other: true, options: [
            op('livestock', 'पशुलाई खुवाउन', 'Livestock drinking'), op('wallow', 'भैंसी आहाल', 'Buffalo wallowing'), op('irrigation', 'सिँचाइ', 'Irrigation'), op('washing', 'लुगा धुन', 'Washing clothes'),
            op('bathing', 'नुहाउन', 'Bathing'), op('ritual', 'धार्मिक / पूजा', 'Religious / ritual'), op('fish', 'माछा', 'Fishing'), op('tourism', 'पर्यटन / डुङ्गा', 'Tourism / boating'),
            op('drinking', 'खानेपानी', 'Drinking water'), op('construction', 'निर्माण कार्य', 'Construction'), op('fire', 'आगलागी नियन्त्रण', 'Fire-fighting'), op('none', 'प्रयोग हुँदैनथ्यो', 'Not used'), other] }),
          F('life_then', 'checks', t('पहिले ताल र वरिपरि कुन-कुन जीव/वनस्पति प्रशस्त देखिन्थे?', 'Which living things were common in or around the lake then?'), { other: true, options: [
            op('fish', 'माछा', 'Fish'), op('frogs', 'भ्यागुता', 'Frogs'), op('leeches', 'जुका', 'Leeches'), op('birds', 'पानीचरा / बसाइँसराइ गर्ने चरा', 'Water birds / migratory birds'),
            op('plants', 'कमल / जलीय वनस्पति', 'Lotus / aquatic plants'), op('algae', 'लेउ / काई', 'Algae / moss'), dk, other] }),
          F('springs_then', 'yn', t('तालनजिक पानी दिने मुहान वा कुवा थिए?', 'Were there springs or wells near the lake that seemed to feed it?'), { evidence: true, hint: t('भए स्थान “Note” मा लेख्नुहोस्।', 'If yes, describe the location in the note.') }),
        ] },

      { id: 'D', title: t('पानी घटेको समयरेखा', 'Timeline of the decline'), show: ['consent', 'yes'], fields: [
        F('noticed', 'yn', t('तालको पानीको सतह घट्दै गएको तपाईंले महसुस गर्नुभएको छ?', 'Have you noticed the lake water level declining?')),
        F('first_noticed', 'bsyear', t('पानी घट्दै गएको पहिलो पटक स्पष्ट रूपमा कुन साल महसुस गर्नुभयो?', 'In which year did you first clearly notice the decline?'), { ref: 12, evidence: true, show: ['noticed', 'yes'], to: 2030 }),
        F('what_noticed', 'checks', t('केले गर्दा थाहा पाउनुभयो?', 'What made you notice it?'), { show: ['noticed', 'yes'], other: true, options: [
          op('bed', 'तालको पिँध देखिन थाल्यो', 'Lake bed became exposed'), op('area', 'क्षेत्रफल सानो भयो', 'Area became smaller'), op('marks', 'किनारमा पुरानो सतहको चिन्ह देखियो', 'Old water marks on the edge'),
          op('livestock', 'पशुले पानी खान नपाए', 'Livestock could not drink'), op('dry', 'पूरै सुक्यो', 'It dried completely'), op('cracks', 'पिँधमा चिरा पर्‍यो', 'Cracks in the dry bed'),
          op('boat', 'डुङ्गा चलाउन छोडियो', 'Boating stopped'), op('told', 'अरूले भनेपछि', 'Others told me'), other] }),
        F('own_words', 'textarea', t('तपाईंको विचारमा के परिवर्तन भयो? (आफ्नै शब्दमा — कारणहरू सुझाव नदिई ठ्याक्कै लेख्नुहोस्)', 'In your own words, what changed? (record verbatim — do NOT suggest causes)'), { show: ['noticed', 'yes'], hint: t('यो प्रश्न भूकम्प, कंक्रिट आदि खण्डअघि सोधिन्छ ताकि उत्तर प्रभावित नहोस्।', 'Asked before the earthquake / construction sections so the answer is not led.') }),
        F('pattern', 'radio', t('यो परिवर्तन अचानक भयो कि वर्षैपिच्छे बिस्तारै?', 'Was the change sudden or gradual over years?'), { ref: 13, show: ['noticed', 'yes'], options: [
          op('sudden', 'अचानक (एकै सिजनभित्र)', 'Sudden (within one season)'), op('gradual', 'वर्षैपिच्छे बिस्तारै', 'Gradual over years'),
          op('sudden_then_gradual', 'सुरुमा अचानक, त्यसपछि बिस्तारै', 'Sudden at first, then gradual'), op('fluctuating', 'घट्ने-बढ्ने (उतारचढाव)', 'Fluctuating'), dk] }),
        F('rate_now', 'radio', t('पानी घट्ने दर अहिले कस्तो छ?', 'How is the rate of decline now?'), { ref: 15, show: ['noticed', 'yes'], options: [
          op('faster', 'झन् छिटो घट्दैछ', 'Getting faster'), op('same', 'उही दरमा घट्दैछ', 'Same rate'), op('slower', 'घट्ने दर कम भएको', 'Slowing down'),
          op('stable', 'स्थिर भएको', 'Stable now'), op('recovering', 'सुधार हुँदैछ', 'Recovering'), dk] }),
        F('low_years', 'textarea', t('कुन-कुन साल विशेष रूपमा कम पानी भएको सम्झना छ? ती वर्ष के भएको थियो?', 'Which years had especially low water? What happened in those years?'), { ref: 14 }),
        F('dried_fully', 'yn', t('पछिल्लो १२ महिनामा ताल पूरै सुक्यो?', 'Did the lake dry completely in the last 12 months?')),
        F('dried_months', 'months', t('कुन महिनामा सुक्यो?', 'In which months?'), { show: ['dried_fully', 'yes'] }),
        F('lo_months_now', 'months', t('अहिले कुन महिनामा पानी सबैभन्दा कम हुन्छ?', 'Months of lowest water now'), { ref: 16 }),
        F('min_duration', 'number', t('न्यून स्तरमा कति हप्तासम्म रहन्छ?', 'How long does it stay at the minimum?'), { unit: 'weeks', min: 0, max: 52, ref: 16 }),
        F('hi_months_now', 'months', t('अहिले कुन महिनामा पानी सबैभन्दा धेरै हुन्छ?', 'Months of highest water now')),
        F('recovered', 'yn', t('घट्न थालेपछि कुनै वर्ष ताल फेरि पहिलेजस्तै भरियो?', 'Since the decline began, has the lake fully recovered in any year?')),
        F('recovered_detail', 'textarea', t('कुन साल? किन होला?', 'Which year, and why do you think?'), { show: ['recovered', 'yes'] }),
        F('timeline', 'grid', t('वर्षअनुसार तालको अवस्था: उत्तरदाताले सम्झेका वर्ष मात्र भर्नुहोस्।', 'Year-by-year lake condition: fill only the years the respondent remembers.'), {
          hint: t('दायाँ लेखिएका घटनाले सम्झन सजिलो बनाउँछ। ५ = भरिएको/सामान्य, १ = सुकेको।', 'The events beside each year help recall. 5 = full / normal, 1 = dry.'),
          rows: TT.yearRows(2062, nowYear), levelColors: true, scale: O.level5,
          cols: [{ ...op('dry', 'सुक्खा याम (चैत–जेठ)', 'Dry season (Chaitra–Jestha)'), short: t('सुक्खा याम', 'Dry season') }, { ...op('wet', 'वर्षापछि (भदौ–असोज)', 'After monsoon (Bhadra–Asoj)'), short: t('वर्षापछि', 'After monsoon') }] }),
      ] },

      { id: 'E', title: t('मौसमी ढाँचा: पहिले र अहिले', 'Seasonal pattern: then and now'), show: ['consent', 'yes'], fields: [
        F('seasonal', 'grid', t('हरेक महिनामा तालको पानी कस्तो हुन्छ? “पहिले” भन्नाले पानी घट्नुअघिको समय।', 'Lake water in each month. “Before” means before the decline began.'), {
          rows: O.months, levelColors: true, scale: O.level5,
          cols: [{ ...op('before', 'पहिले (घट्नुअघि)', 'Before the decline'), short: t('पहिले', 'Before') }, { ...op('now', 'अहिले (पछिल्लो १२ महिना)', 'Now (last 12 months)'), short: t('अहिले', 'Now') }] }),
        F('rise_after_rain', 'radio', t('ठूलो पानी परेपछि तालको सतह कति छिटो बढ्छ?', 'After heavy rain, how quickly does the lake rise?'), { options: [
          op('same_day', 'तुरुन्तै (सोही दिन)', 'Immediately (same day)'), op('1_3', '१–३ दिनमा', 'Within 1–3 days'), op('week', 'एक हप्तापछि', 'After about a week'),
          op('little', 'खासै बढ्दैन', 'Hardly rises'), dk] }),
        F('drop_after_full', 'number', t('भरिएपछि कति दिनमा स्पष्ट रूपमा घटेको देखिन्छ?', 'After it fills, how many days until a clear drop is visible?'), { unit: 'days', min: 0, max: 365, ref: 42 }),
      ] },

      { id: 'F', title: t('पानीका स्रोत र आउने बाटो', 'Water sources and inflow paths'), show: ['consent', 'yes'], fields: [
        F('src_where', 'checks', t('तपाईंको बुझाइमा तालमा पानी कहाँबाट आउँछ?', 'In your understanding, where does the lake’s water come from?'), { ref: 23, options: [
          op('rain', 'सिधै तालमा परेको वर्षा', 'Rain falling directly on the lake'), op('runoff', 'वरपरको भिरालोबाट बग्ने पानी', 'Runoff from surrounding slopes'),
          op('gully', 'सानो खोल्सा / कुलो', 'Small gully / channel'), op('spring', 'मुहान', 'Spring'), op('ground', 'जमिनमुनिबाट', 'From underground'),
          op('road', 'सडकको नाली', 'Road drain'), op('pipe', 'पाइप / कुलोबाट ल्याइएको', 'Piped / diverted water'), dk] }),
        F('runoff_dir', 'checks', t('वर्षामा कुन दिशाबाट सबैभन्दा धेरै पानी तालतिर आउँछ?', 'From which direction does most rainwater come to the lake?'), { ref: 24, options: O.dirDk,
          hint: t('सम्भव भए उत्तरदातालाई फिल्डमै देखाउन अनुरोध गर्नुहोस्।', 'If possible ask the respondent to show it on site.') }),
        F('runoff_pt', 'gps', t('देखाइएको मुख्य पानी आउने ठाउँको GPS', 'GPS of the main inflow point shown'), { ref: 24 }),
        F('runoff_photo', 'photos', t('पानी आउने ठाउँको फोटो', 'Photo of the inflow point'), { show: ['consent_photo', 'yes'] }),
        F('path_closed', 'yn', t('पहिले पानी आउने तर अहिले बन्द/कम भएको बाटो, खोल्सा वा होचो ठाउँ छ?', 'Is there an old inflow path, gully or low point that is now closed or reduced?'), { ref: 25, evidence: true }),
        F('path_closed_by', 'checks', t('केले बन्द गर्‍यो?', 'What closed it?'), { show: ['path_closed', 'yes'], other: true, options: [
          op('road', 'सडक', 'Road'), op('concrete', 'कंक्रिट पर्खाल / किनार', 'Concrete wall / edge'), op('fill', 'माटो पुरिएर', 'Filled with soil'), op('plants', 'बोटबिरुवा / वृक्षारोपण', 'Vegetation / plantation'),
          op('house', 'घर / संरचना', 'House / structure'), op('rpond', 'पोखरी / खाल्डो', 'Recharge pond / trench'), dk, other] }),
        F('path_closed_year', 'bsyear', t('कहिले बन्द भयो?', 'When was it closed?'), { show: ['path_closed', 'yes'] }),
        F('path_closed_pt', 'gps', t('बन्द भएको बाटोको GPS', 'GPS of the closed path'), { show: ['path_closed', 'yes'] }),
        F('springs_change', 'radio', t('तालनजिकका मुहानहरू पहिले र अहिले कस्ता छन्?', 'How have nearby springs changed?'), { ref: 26, options: [
          op('less', 'पानी घटेको', 'Discharge decreased'), op('dried', 'सुकेको', 'Dried up'), op('more', 'पानी बढेको', 'Discharge increased'), op('same', 'परिवर्तन छैन', 'No change'),
          op('none', 'नजिक मुहान छैन', 'No springs nearby'), dk] }),
        F('springs_detail', 'textarea', t('मुहानको नाम/स्थान, के परिवर्तन भयो र कहिले?', 'Spring name/location, what changed and when?'), { ref: 26, show: ['springs_change', ['less', 'dried', 'more']] }),
        F('road_changed', 'yn', t('सडक, कल्भर्ट वा नालीले वर्षाको पानीको दिशा परिवर्तन गरेको छ?', 'Have roads, culverts or ditches changed where rainwater goes?'), { ref: 27, evidence: true }),
        F('road_changed_detail', 'textarea', t('कुन सडक/संरचना? अहिले पानी कता जान्छ?', 'Which road/structure? Where does the water go now?'), { show: ['road_changed', 'yes'] }),
        F('road_changed_year', 'bsyear', t('कहिले बनेको?', 'When was it built?'), { show: ['road_changed', 'yes'] }),
        F('road_changed_pt', 'gps', t('त्यो ठाउँको GPS', 'GPS of that location'), { show: ['road_changed', 'yes'] }),
        F('recharge_works', 'checks', t('माथिल्लो क्षेत्रमा के-कस्ता संरक्षण कार्य भएका छन्?', 'What conservation works exist in the upper area?'), { ref: 28, options: [
          op('pond', 'पुनर्भरण (recharge) पोखरी', 'Recharge ponds'), op('trench', 'कन्टुर / पानी सोस्ने खाल्डो', 'Contour / infiltration trenches'), op('plant', 'वृक्षारोपण', 'Plantation'),
          op('checkdam', 'चेकड्याम', 'Check dams'), op('none', 'केही पनि छैन', 'None'), dk] }),
        F('recharge_year', 'bsyear', t('ती कार्य कहिले भए?', 'When were they built?'), { ref: 28, show: ['recharge_works', ['pond', 'trench', 'plant', 'checkdam']] }),
        F('recharge_effect', 'radio', t('त्यसपछि तालमा के फरक देखियो?', 'What difference followed in the lake?'), { ref: 28, show: ['recharge_works', ['pond', 'trench', 'plant', 'checkdam']], options: [
          op('better', 'सुधार भयो', 'Improved'), op('worse', 'झन् बिग्रियो', 'Became worse'), op('none', 'फरक परेन', 'No difference'), dk] }),
        F('inflow_rain', 'radio', t('ठूलो पानी पर्दा तालतिर पानी बगेर आएको देखिन्छ?', 'During heavy rain, can you see water flowing into the lake?'), { options: [
          op('lot', 'धेरै आउँछ', 'Yes, a lot'), op('little', 'अलिअलि आउँछ', 'Yes, a little'), op('no', 'आउँदैन, अन्यत्र जान्छ', 'No, it goes elsewhere'), dk] }),
        F('inflow_elsewhere', 'textarea', t('पानी कता जान्छ?', 'Where does it go instead?'), { show: ['inflow_rain', 'no'] }),
        F('artificial_in', 'yn', t('कहिल्यै पाइप वा कुलोबाट तालमा पानी ल्याइन्छ?', 'Is water ever brought into the lake by pipe or channel?')),
      ] },

      { id: 'G', title: t('निकास, ओभरफ्लो र चुहावट', 'Outlet, overflow and seepage'), show: ['consent', 'yes'], fields: [
        F('outlet_past', 'yn', t('पहिले तालमा पानी निस्कने बाटो / overflow / नाली थियो?', 'Was there an outlet, overflow or drain in the past?'), { ref: 38 }),
        F('outlet_now', 'yn', t('अहिले छ?', 'Is there one now?'), { ref: 38 }),
        F('outlet_pt', 'gps', t('निकासको GPS', 'GPS of the outlet'), { ref: 38, showIf: (v) => v.outlet_now === 'yes' || v.outlet_past === 'yes', when: 'Ask if G1 or G2 = Yes' }),
        F('reg_drain', 'yn', t('पानी छाड्ने ढोका/पाइप/कुलो (२०१७ को सरकारी विवरणमा उल्लेखित “regulated drain”) स्थानीय रूपमा चिनिन्छ?', 'Is a gate, pipe or channel for releasing water (the “regulated drain” in the 2017 inventory) known locally?'), { ref: 39 }),
        F('reg_drain_desc', 'textarea', t('कस्तो छ, कहाँ छ, कसले र कहिले चलाउँछ?', 'What is it, where, who operates it and when?'), { show: ['reg_drain', 'yes'] }),
        F('overflow_dir', 'checks', t('धेरै वर्षा हुँदा पोखिएको पानी कुन दिशातिर जान्छ?', 'In very heavy rain, which way does overflow go?'), { ref: 40, options: [...O.dirDk, op('never', 'पोखिँदैन', 'Never overflows')] }),
        F('down_wet', 'yn', t('तालभन्दा तल सधैँ भिजेको जमिन, सानो मुहान, चुहावट वा हरियो पट्टी छ?', 'Below the lake, is there permanently wet ground, a small spring, seepage or a green strip?'), { ref: 41, evidence: true }),
        F('down_wet_since', 'bsyear', t('कहिलेदेखि?', 'Since when?'), { show: ['down_wet', 'yes'] }),
        F('down_wet_season', 'radio', t('त्यो कहिले बढी देखिन्छ?', 'When is it most visible?'), { show: ['down_wet', 'yes'], options: [
          op('always', 'सधैँ', 'Always'), op('monsoon', 'वर्षामा मात्र', 'Monsoon only'), op('dry', 'सुक्खा मौसममा बढी', 'More in the dry season'), op('full', 'ताल भरिँदा मात्र', 'Only when the lake is full'), dk] }),
        F('down_wet_pt', 'gps', t('त्यो ठाउँको GPS', 'GPS of that place'), { show: ['down_wet', 'yes'] }),
        F('down_wet_photo', 'photos', t('फोटो', 'Photo'), { showIf: (v) => v.down_wet === 'yes' && v.consent_photo === 'yes', when: 'Ask if G7 = Yes and photo consent' }),
        F('drop_pattern', 'yn', t('पानी एउटा निश्चित तहसम्म छिटो घटेर त्यसपछि स्थिर हुन्छ?', 'Does the water drop quickly to a certain level and then stay stable?'), { ref: 42 }),
        F('drop_level', 'textarea', t('कुन चिन्ह/चिनारीमा पुगेर स्थिर हुन्छ?', 'At which mark or landmark does it stabilise?'), { show: ['drop_pattern', 'yes'], ref: 42 }),
        F('sink_seen', 'radio', t('कुनै चिरा, प्वाल, ओडार वा चट्टानको जोर्नीबाट पानी हराएको देख्नुभएको/सुन्नुभएको छ?', 'Have you seen or heard of water disappearing into a crack, hole, cave or rock joint?'), { ref: 43, options: [
          op('seen', 'आफैँले देखेको', 'Seen myself'), op('heard', 'सुनेको मात्र', 'Only heard'), op('no', 'देखेको/सुनेको छैन', 'Neither')] }),
        F('sink_where', 'textarea', t('कहाँ? कहिले?', 'Where and when?'), { show: ['sink_seen', ['seen', 'heard']] }),
        F('sink_pt', 'gps', t('त्यो ठाउँको GPS', 'GPS of that place'), { show: ['sink_seen', ['seen', 'heard']] }),
        F('down_springs_link', 'yn', t('ताल भरिएको बेला तलका मुहान/धारा/कुवामा पानी बढ्छ?', 'When the lake is full, do springs, taps or wells below it flow more?'), { evidence: true }),
      ] },

      { id: 'H', title: t('ताल क्षेत्रमा भएका निर्माण तथा संरक्षण कार्य', 'Construction and conservation works at the lake'), show: ['consent', 'yes'], fields: [
        F('works', 'checks', t('ताल र वरिपरि के-कस्ता निर्माण कार्य भएका छन्?', 'Which works have been done in or around the lake?'), { other: true, options: [
          op('concrete', 'किनारमा कंक्रिट lining', 'Concrete edge lining'), op('wall', 'कंक्रिट/ढुंगाको पर्खाल', 'Concrete / stone wall'), op('bed', 'पिँधमा कंक्रिट वा माटोको lining', 'Concrete or clay lining of the bed'),
          op('dig', 'खनेर गहिरो बनाइएको', 'Excavation / deepening'), op('desilt', 'सफाइ / गेग्रान झिकिएको', 'Cleaning / de-silting'), op('walkway', 'पैदलमार्ग', 'Walkway'),
          op('steps', 'सिँढी / घाट', 'Steps / ghat'), op('fence', 'बार / तारबार', 'Fence'), op('tourism', 'पर्यटकीय संरचना (भ्यू टावर, छाप्रो)', 'Tourism structures (view tower, huts)'),
          op('road', 'तालनजिक सडक', 'Road near the lake'), op('drain', 'नाली / कल्भर्ट', 'Drain / culvert'), op('rpond', 'पुनर्भरण पोखरी', 'Recharge pond'), op('plant', 'वृक्षारोपण', 'Plantation'),
          op('none', 'केही छैन', 'None'), dk, other] }),
        F('con_year', 'bsyear', t('कंक्रिट lining / किनारको काम कहिले सुरु भयो?', 'When did the concrete lining / edge work start?'), { ref: 29, show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_year_end', 'bsyear', t('कहिले सकियो (वा पछिल्लो ठूलो काम)?', 'When was it completed (or the last major work)?'), { show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_agency', 'checks', t('कसले / कुन निकायले गरेको हो?', 'Who / which agency did it?'), { ref: 29, other: true, options: O.agency, show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_contractor', 'text', t('ठेकेदार वा उपभोक्ता समितिको नाम (थाहा भए)', 'Contractor or user committee (if known)'), { show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_purpose', 'checks', t('कंक्रिट काम किन गरिएको थियो?', 'Why was the concrete work done?'), { ref: 30, other: true, show: ['works', ['concrete', 'wall', 'bed']], options: [
          op('seepage', 'चुहावट रोक्न', 'Stop seepage'), op('beauty', 'सौन्दर्य', 'Beautification'), op('erosion', 'किनार कटान रोक्न', 'Erosion protection'),
          op('tourism', 'पर्यटन', 'Tourism'), op('safety', 'सुरक्षा', 'Safety'), dk, other] }),
        F('con_extent', 'radio', t('कति भागमा कंक्रिट छ?', 'How much is concreted?'), { show: ['works', ['concrete', 'wall', 'bed']], options: [
          op('full', 'पूरै किनार', 'Whole perimeter'), op('part', 'किनारको केही भाग', 'Part of the perimeter'), op('bed', 'पिँध पनि', 'Bed as well'),
          op('embank', 'बाँध / embankment मात्र', 'Embankment only'), dk] }),
        F('con_before', 'textarea', t('कंक्रिट हुनुअघि पानीको सतह / गहिराइ कस्तो थियो?', 'What were the water level and depth before the concrete?'), { ref: 31, evidence: true, show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_after', 'radio', t('कंक्रिट भएपछि के भयो?', 'What happened after the concrete work?'), { ref: 32, show: ['works', ['concrete', 'wall', 'bed']], options: [
          op('drop_now', 'तुरुन्तै घट्यो', 'Dropped immediately'), op('drop_later', 'केही वर्षपछि घट्यो', 'Dropped some years later'), op('no_change', 'फरक परेन', 'No change'),
          op('better', 'सुधार भयो', 'Improved'), op('before', 'कंक्रिटअघि नै घट्न थालिसकेको थियो', 'Decline had started before the concrete'), dk] }),
        F('con_closed', 'yn', t('कंक्रिट बनाउँदा पहिलेका प्राकृतिक पानी आउने बाटो, माटोका किनारा वा नाली बन्द भए?', 'Were natural inflow paths, soil edges or drains closed during construction?'), { ref: 33, evidence: true, show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_closed_pt', 'gps', t('बन्द भएको ठाउँको GPS', 'GPS of the closed path'), { show: ['con_closed', 'yes'] }),
        F('con_excavated', 'yn', t('काम गर्दा तालको पिँध वा किनार खनियो / गहिरो बनाइयो / माटो हटाइयो?', 'Was the bed or edge dug out, deepened or soil removed?'), { ref: 34, show: ['works', ['concrete', 'wall', 'bed', 'dig']] }),
        F('con_excavated_detail', 'textarea', t('कति गहिरो, कहाँ, माटो कहाँ फालियो?', 'How deep, where, and where was the soil dumped?'), { show: ['con_excavated', 'yes'] }),
        F('con_weep', 'yn', t('पानी छिर्न प्वाल (weep hole) वा खुला भाग छोडिएको छ?', 'Were openings (weep holes, gaps) left for water to enter?'), { show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_cracks', 'yn', t('कंक्रिटमा अहिले चिरा, जोर्नी खुलेको, भासिएको वा पानी छिर्ने/निस्कने ठाउँ छ?', 'Are there cracks, open joints, settlement or water passing through the concrete now?'), { ref: 35, show: ['works', ['concrete', 'wall', 'bed']] }),
        F('con_cracks_pt', 'gps', t('चिराको GPS', 'GPS of the crack'), { show: ['con_cracks', 'yes'] }),
        F('con_cracks_photo', 'photos', t('चिराको फोटो', 'Photo of the crack'), { show: ['con_cracks', 'yes'] }),
        F('con_dry_change', 'radio', t('कंक्रिटअघिको तुलनामा अहिले ताल कसरी सुक्छ?', 'Compared with before the concrete, the lake now dries'), { ref: 36, show: ['works', ['concrete', 'wall', 'bed']], options: [
          op('earlier', 'छिटो / चाँडो सुक्छ', 'Earlier / faster'), op('same', 'उस्तै', 'Same'), op('later', 'ढिलो सुक्छ', 'Later / slower'), dk] }),
        F('con_where', 'textarea', t('कंक्रिटले समस्या गरेको लाग्छ भने कुन ठाउँमा र किन?', 'If you think the concrete caused problems: which specific place and why?'), { ref: 37, show: ['works', ['concrete', 'wall', 'bed']] }),
        F('consulted', 'yn', t('काम गर्नुअघि स्थानीयसँग सल्लाह गरिएको थियो?', 'Were local people consulted before the works?'), { showIf: (v) => Array.isArray(v.works) && v.works.some((x) => !['none', 'dk'].includes(x)), when: 'Ask if any work was named in H1' }),
        F('dredged', 'yn', t('ताल सफा / गेग्रान झिक्ने (dredge) काम भएको छ?', 'Has the lake been cleaned or de-silted?'), { ref: 54 }),
        F('dredged_year', 'bsyear', t('कहिले?', 'When?'), { show: ['dredged', 'yes'], ref: 54 }),
        F('dredged_detail', 'textarea', t('कति माटो निकालियो, कति गहिरो, माटो कहाँ राखियो?', 'How much soil, how deep, where was it put?'), { show: ['dredged', 'yes'], ref: 54 }),
        F('other_works_detail', 'textarea', t('अन्य कार्यहरूको विवरण (साल, निकाय, उद्देश्य)', 'Details of other works (year, agency, purpose)')),
      ] },

      { id: 'I', title: t('२०७२ सालको भूकम्प', 'The 2072 BS (2015) earthquake'), show: ['consent', 'yes'],
        note: t('तटस्थ रहनुहोस्: भूकम्पले ताल सुकाएको हो भनेर सुझाव नदिनुहोस्। “परिवर्तन भएन” पनि महत्त्वपूर्ण उत्तर हो।', 'Stay neutral: do not suggest that the earthquake dried the lake. “No change” is an equally important answer.'),
        fields: [
          F('eq_here', 'yn', t('२०७२ वैशाखको भूकम्पका बेला तपाईं यहीँ बस्नुहुन्थ्यो?', 'Were you living here at the time of the Baisakh 2072 earthquake?'), { dk: false }),
          F('eq_change', 'radio', t('भूकम्पपछि तालमा कुनै परिवर्तन देख्नुभयो?', 'Did you notice any change in the lake after the earthquake?'), { ref: 17, evidence: true, options: [
            op('down', 'पानी घट्यो', 'Water decreased'), op('up', 'पानी बढ्यो', 'Water increased'), op('none', 'परिवर्तन भएन', 'No change'), dk] }),
          F('eq_when', 'radio', t('परिवर्तन कति समयपछि देखियो?', 'How soon after was the change visible?'), { ref: 18, show: ['eq_change', ['down', 'up']], options: [
            op('days', 'तुरुन्तै (केही दिनभित्र)', 'Immediately (days)'), op('weeks', 'केही हप्तापछि', 'After some weeks'), op('months', 'केही महिनापछि', 'After some months'),
            op('dry_season', 'अर्को सुक्खा मौसममा', 'In the next dry season'), op('years', 'केही वर्षपछि', 'Some years later')] }),
          F('eq_signs', 'checks', t('ताल वरिपरि भूकम्पपछि यी मध्ये केही देखियो?', 'Did any of these appear around the lake after the earthquake?'), { ref: 19, evidence: true, options: [
            op('ground_cracks', 'जमिनमा चिरा', 'Cracks in the ground'), op('bed_cracks', 'तालको पिँध/किनारमा चिरा', 'Cracks in the lake bed or edge'), op('subsidence', 'जमिन भासिएको', 'Ground subsidence'),
            op('landslide', 'पहिरो', 'Landslide'), op('new_spring', 'नयाँ मुहान फुटेको', 'New spring appeared'), op('spring_dried', 'पुरानो मुहान सुकेको', 'Old spring dried'),
            op('spring_change', 'मुहानको पानी घटबढ', 'Spring flow changed'), op('turbid', 'पानी धमिलो भएको', 'Water became muddy'), op('none', 'केही देखिएन', 'Nothing seen'), dk] }),
          F('eq_signs_where', 'textarea', t('ठ्याक्कै कहाँ? अरू कसले देखे?', 'Exactly where? Who else saw it?'), { showIf: notIn('eq_signs', ['none', 'dk']), when: 'Ask if a sign was named in I4' }),
          F('eq_signs_pt', 'gps', t('त्यो ठाउँको GPS', 'GPS of that place'), { showIf: notIn('eq_signs', ['none', 'dk']), when: 'Ask if a sign was named in I4' }),
          F('eq_seep', 'yn', t('भूकम्पपछि तालभन्दा तल नयाँ भिजेको ठाउँ, चुहावट वा पानी निस्कने ठाउँ देखियो?', 'After the earthquake, did new wet places, seepage or water outlets appear below the lake?'), { ref: 20, evidence: true }),
          F('eq_landmark', 'textarea', t('भूकम्पअघि र पछिको पानीको सतह तुलना गर्न मिल्ने फोटो वा चिनारी छ?', 'Is there a photo or landmark that shows the level before and after?'), { ref: 21 }),
          F('eq_basis', 'radio', t('भूकम्पलाई कारण मान्नुहुन्छ भने मुख्य आधार के हो?', 'If you consider the earthquake a cause, what is the main basis?'), { ref: 22, options: [
            op('physical', 'प्रत्यक्ष देखेको भौतिक परिवर्तन', 'Physical change I saw'), op('timing', 'समय मिलेकाले', 'The timing matches'), op('heard', 'अरूबाट सुनेको', 'Heard from others'),
            op('official', 'विज्ञ / अधिकारीले भनेको', 'Experts / officials said so'), op('not_cause', 'भूकम्पलाई कारण मान्दिनँ', 'I do not think it is a cause'), dk] }),
          F('eq_house', 'textarea', t('भूकम्पपछि तपाईंको क्षेत्रका धारा, मुहान, कुवा वा घरमा के परिवर्तन आयो?', 'After the earthquake, what changed in taps, springs, wells or houses in your area?')),
          F('eq_later', 'radio', t('पछिका भूकम्प (जस्तै २०८० जाजरकोट) पछि तालमा परिवर्तन देखियो?', 'After later earthquakes (e.g. 2080 Jajarkot), any change in the lake?'), { options: [
            op('yes', 'देखियो', 'Yes'), op('no', 'देखिएन', 'No'), dk] }),
        ] },

      { id: 'J', title: t('वर्षा र मौसम', 'Rainfall and climate'), show: ['consent', 'yes'], fields: [
        F('rain_change', 'radio', t('पछिल्ला १०–२० वर्षमा कुल वर्षा', 'Total rainfall over the last 10–20 years'), { ref: 44, options: O.change5 }),
        F('dry_spells', 'yn', t('लामो खडेरी (पानी नपर्ने अवधि) बढेको छ?', 'Have dry spells become longer?'), { ref: 45 }),
        F('monsoon_start', 'radio', t('मनसुन सुरु हुने समय', 'Monsoon onset'), { ref: 46, options: [op('earlier', 'चाँडो', 'Earlier'), op('later', 'ढिलो', 'Later'), op('same', 'परिवर्तन छैन', 'No change'), dk] }),
        F('monsoon_end', 'radio', t('मनसुन सकिने समय', 'Monsoon withdrawal'), { ref: 46, options: [op('earlier', 'चाँडो सकिन्छ', 'Ends earlier'), op('later', 'ढिलो सकिन्छ', 'Ends later'), op('same', 'परिवर्तन छैन', 'No change'), dk] }),
        F('winter_rain', 'radio', t('हिउँदे / वसन्त ऋतुको वर्षा', 'Winter / spring rain'), { ref: 47, options: O.change5 }),
        F('heavy_rain', 'radio', t('छोटो समयमा धेरै पानी पर्ने (मुसलधारे) घटना', 'Intense downpours'), { options: O.change5 }),
        F('heat', 'radio', t('गर्मी / तापक्रम', 'Heat / temperature'), { ref: 48, options: O.change5 }),
        F('frost', 'radio', t('हिउँदमा तुसारो / हिउँ', 'Frost / snow in winter'), { options: O.change5 }),
        F('rain_lake_link', 'radio', t('कम वर्षा भएका वर्ष र तालमा कम पानी भएका वर्ष मेल खान्छन्?', 'Do low-rain years coincide with low-lake years?'), { ref: 49, options: [
          op('always', 'सधैँ मेल खान्छ', 'Always'), op('sometimes', 'कहिलेकाहीँ', 'Sometimes'), op('no', 'मेल खाँदैन', 'No'), dk] }),
        F('rain_lake_examples', 'textarea', t('उदाहरण (साल)', 'Examples (years)'), { show: ['rain_lake_link', ['always', 'sometimes', 'no']] }),
        F('other_sources', 'radio', t('गाउँका अरू पानीका स्रोत (मुहान, धारा, कुवा) पनि घटेका छन्?', 'Have other water sources in the village (springs, taps, wells) also declined?'), {
          hint: t('यसले जलवायुजन्य कारण र तालको स्थानीय कारण छुट्याउन मद्दत गर्छ।', 'Key discriminator between a regional (climate) cause and a lake-specific cause.'),
          options: [op('many', 'धेरै घटेका छन्', 'Many have declined'), op('some', 'केही घटेका छन्', 'Some have declined'), op('no', 'घटेका छैनन्', 'Not declined'), dk] }),
        F('worst_drought', 'bsyear', t('तपाईंले सम्झेको सबैभन्दा ठूलो खडेरी कुन साल थियो?', 'Worst drought year you remember'), { to: 2020 }),
      ] },

      { id: 'K', title: t('भू-उपयोग, सडक, पशु र गेग्रान', 'Land use, roads, livestock and sediment'), show: ['consent', 'yes'], fields: [
        F('landcover', 'grid', t('ताल वरिपरिको भू-उपयोगमा पानी घट्नुअघिको तुलनामा के परिवर्तन भयो?', 'How has land use around the lake changed since before the decline?'), { ref: 50, scale: O.trend,
          cols: [op('chg', 'परिवर्तन', 'Change')],
          rows: [op('forest', 'वन', 'Forest'), op('grass', 'घाँसे / चरन क्षेत्र', 'Grassland / grazing'), op('farm', 'खेतीबारी', 'Farmland'), op('abandoned', 'बाँझो जमिन', 'Abandoned land'),
            op('houses', 'घर / बस्ती', 'Houses'), op('roads', 'सडक / बाटो', 'Roads / tracks'), op('tourism', 'पर्यटकीय संरचना', 'Tourism facilities')] }),
        F('road_built', 'bsyear', t('तालनजिक सडक कहिले पुग्यो / स्तरोन्नति भयो?', 'When did the road reach (or get upgraded) near the lake?')),
        F('road_effect', 'checks', t('सडक / बाटो बनेपछि के फरक आयो?', 'What changed after the road/track was built?'), { ref: 51, options: [
          op('more_in', 'तालमा बढी पानी आउँछ', 'More water reaches the lake'), op('less_in', 'तालमा कम पानी आउँछ', 'Less water reaches the lake'),
          op('erosion', 'कटान / गेग्रान बढ्यो', 'More erosion / sediment'), op('none', 'फरक परेन', 'No difference'), dk] }),
        F('sediment', 'radio', t('पहिलेको तुलनामा तालमा माटो/गाद (sediment) जम्ने', 'Silt / sediment in the lake compared with before'), { ref: 52, options: O.change5 }),
        F('sediment_dir', 'checks', t('कुन दिशाबाट माटो/गाद बढी आउँछ?', 'From which direction does most sediment come?'), { ref: 53, options: O.dirDk }),
        F('sediment_pt', 'gps', t('गेग्रान आउने मुख्य ठाउँको GPS (देखाएमा)', 'GPS of the main sediment source (if shown)'), { ref: 53 }),
        F('plantation', 'yn', t('ताल वरिपरि वा माथि वृक्षारोपण गरिएको छ?', 'Has plantation been done around or above the lake?')),
        F('plant_species', 'checks', t('कुन प्रजाति?', 'Which species?'), { show: ['plantation', 'yes'], other: true, options: [
          op('pine', 'सल्ला', 'Pine'), op('alder', 'उत्तिस', 'Alder'), op('schima', 'चिलाउने', 'Schima'), op('castanopsis', 'कटुस', 'Castanopsis'), op('local', 'अन्य स्थानीय प्रजाति', 'Other native species'), dk, other] }),
        F('plant_year', 'bsyear', t('कहिले?', 'When?'), { show: ['plantation', 'yes'] }),
        F('livestock', 'grid', t('तालमा आउने पशु पहिले र अहिले', 'Livestock coming to the lake, then and now'), { ref: 55,
          rows: [op('buffalo', 'भैंसी', 'Buffalo'), op('cattle', 'गाई / गोरु', 'Cattle'), op('goats', 'बाख्रा / भेडा', 'Goats / sheep')],
          cols: [op('then', 'पहिले', 'Then'), op('now', 'अहिले', 'Now')],
          scale: [op('many', 'धेरै', 'Many'), op('some', 'केही', 'Some'), op('few', 'थोरै', 'Few'), op('none', 'छैन', 'None'), dk] }),
        F('wallow', 'radio', t('पहिले भैंसी तालमा आहाल बस्थे? अहिले के छ?', 'Did buffaloes wallow in the lake? And now?'), {
          hint: t('भैंसी आहालले पिँधको माटो खाँदिएर पानी अड्याउन मद्दत गर्न सक्छ।', 'Wallowing can puddle and seal the bed; its loss is a testable mechanism (H7).'),
          options: [op('stopped', 'पहिले बस्थे, अहिले बस्दैनन्', 'Used to, not any more'), op('still', 'अहिले पनि बस्छन्', 'Still do'), op('never', 'कहिल्यै बस्दैनथे', 'Never did'), dk] }),
        F('wallow_stop', 'bsyear', t('कहिलेदेखि बस्न छोडे?', 'Since when have they stopped?'), { show: ['wallow', 'stopped'] }),
        F('trad_maint', 'radio', t('तालको पिँध/किनार माटोले लिप्ने वा सामूहिक सरसफाइ गर्ने परम्परा थियो?', 'Was there a tradition of plastering the bed/edge with clay or community cleaning?'), { options: [
          op('still', 'थियो र अझै छ', 'Yes, still practised'), op('stopped', 'थियो तर छोडियो', 'Yes, but stopped'), op('never', 'थिएन', 'No'), dk] }),
        F('trad_stop', 'bsyear', t('कहिले छोडियो?', 'When did it stop?'), { show: ['trad_maint', 'stopped'] }),
        F('outmigration', 'radio', t('पहिलेको तुलनामा यस क्षेत्रमा बस्ने घर / मानिसको संख्या', 'Number of households / people living here compared with before'), { options: O.change5 }),
        F('fire', 'yn', t('ताल माथिको क्षेत्रमा वन डढेलो लागेको थियो?', 'Has there been a forest fire in the area above the lake?')),
        F('fire_year', 'bsyear', t('कहिले?', 'When?'), { show: ['fire', 'yes'] }),
      ] },

      { id: 'L', title: t('पानीको उपयोग र व्यवस्थापन', 'Water use and management'), show: ['consent', 'yes'], fields: [
        F('extraction', 'yn', t('तालबाट पानी पम्प वा अरू तरिकाले निकालिन्छ?', 'Is water pumped or taken from the lake?'), { ref: 56 }),
        F('extraction_detail', 'textarea', t('केका लागि, कुन मौसममा, कति र कहिलेदेखि?', 'For what, which season, how much and since when?'), { ref: 56, show: ['extraction', 'yes'] }),
        F('tourism_use', 'yn', t('पर्यटन विकासपछि पानीको प्रयोग वा किनारमा निर्माण बढेको छ?', 'Since tourism development, has water use or shoreline construction increased?'), { ref: 57 }),
        F('cons_works', 'textarea', t('ताल संरक्षणका लागि अहिलेसम्म के-कस्ता काम भए? कुन प्रभावकारी लाग्यो?', 'What conservation work has been done so far? Which was effective?'), { ref: 58 }),
        F('interv_effect', 'textarea', t('कुन कामपछि अवस्था सुधार भयो वा बिग्रियो?', 'After which intervention did conditions improve or worsen?'), { ref: 59 }),
        F('responsible', 'checks', t('तालको जिम्मेवारी कसले लिन्छ?', 'Who takes responsibility for the lake?'), { ref: 60, other: true, options: [
          op('ward', 'वडा कार्यालय', 'Ward office'), op('rm', 'गाउँपालिका', 'Rural municipality'), op('cfug', 'सामुदायिक वन उपभोक्ता समूह', 'Community forest user group'),
          op('committee', 'ताल संरक्षण समिति', 'Lake conservation committee'), op('homestay', 'होमस्टे समिति', 'Homestay committee'), op('religious', 'धार्मिक समूह', 'Religious group'),
          op('none', 'कोही होइन', 'Nobody'), dk, other] }),
        F('records', 'yn', t('पानीको सतहको नियमित अभिलेख वा मर्मतसम्भार हुन्छ?', 'Is there any regular water-level record or maintenance?'), { ref: 60 }),
        F('dispute', 'radio', t('तालवरिपरि वा पानी आउने क्षेत्रमा जग्गा स्वामित्व वा विवादका समस्या छन्?', 'Are there land-ownership issues or disputes affecting the lake or its recharge area?'), { options: [
          op('yes', 'छ', 'Yes'), op('no', 'छैन', 'No'), op('decline', 'भन्न चाहन्नँ', 'Prefer not to say')] }),
        F('dispute_detail', 'textarea', t('संक्षेपमा बताइदिनुहोस्', 'Briefly describe'), { show: ['dispute', 'yes'] }),
        F('participate', 'checks', t('ताल संरक्षणमा तपाईंको परिवार कसरी सहभागी हुन सक्छ?', 'How could your household take part in conserving the lake?'), { options: [
          op('labour', 'श्रमदान', 'Voluntary labour'), op('cash', 'आर्थिक सहयोग', 'Cash contribution'), op('gauge', 'नियमित पानीको सतह नाप्ने (स्टाफ गेज पढ्ने)', 'Reading the water-level gauge regularly'),
          op('committee', 'समितिमा सहभागी', 'Join a committee'), op('none', 'सहभागी हुन सक्दिनँ', 'Cannot take part')] }),
        F('gauge_reader', 'yn', t('हप्तामा एक पटक स्टाफ गेज पढेर फोटो पठाउन इच्छुक हुनुहुन्छ?', 'Willing to read the staff gauge weekly and send a photo?'), { show: ['participate', 'gauge'], dk: false }),
      ] },

      { id: 'M', title: t('जीवनयापन र समुदायमा प्रभाव', 'Livelihood and community impacts'), show: ['consent', 'yes'], fields: [
        F('importance', 'radio', t('तपाईंको परिवारका लागि ताल कत्तिको महत्त्वपूर्ण छ?', 'How important is the lake for your household?'), { options: [
          op('very', 'धेरै महत्त्वपूर्ण', 'Very important'), op('imp', 'महत्त्वपूर्ण', 'Important'), op('some', 'केही हदसम्म', 'Somewhat'), op('not', 'महत्त्वपूर्ण छैन', 'Not important')] }),
        F('impacts', 'checks', t('पानी घटेकाले तपाईंको परिवारलाई के असर पर्‍यो?', 'How has the decline affected your household?'), { other: true, options: [
          op('livestock', 'पशुलाई पानी अभाव', 'Less water for livestock'), op('irrigation', 'सिँचाइ घट्यो', 'Less irrigation'), op('income', 'पर्यटक / आम्दानी घट्यो', 'Fewer tourists / less income'),
          op('beauty', 'सौन्दर्य घट्यो', 'Loss of beauty'), op('biodiv', 'माछा / भ्यागुता / चरा घटे', 'Loss of fish / frogs / birds'), op('culture', 'धार्मिक / सांस्कृतिक क्षति', 'Religious / cultural loss'),
          op('distance', 'पानी लिन टाढा जानुपर्ने', 'Longer trips to fetch water'), op('conflict', 'पानीमा विवाद', 'Conflict over water'), op('none', 'असर छैन', 'No impact'), other] }),
        F('impact_severity', 'scale', t('असर कति गम्भीर छ?', 'How severe is the impact?'), { options: [
          op('1', '१ धेरै कम', '1 Very low'), op('2', '२ कम', '2 Low'), op('3', '३ मध्यम', '3 Moderate'), op('4', '४ गम्भीर', '4 Serious'), op('5', '५ धेरै गम्भीर', '5 Very serious')] }),
        F('visitors', 'radio', t('पछिल्ला ३ वर्षमा पर्यटक संख्या', 'Visitor numbers over the last 3 years'), { options: [
          op('up', 'बढेको', 'Increased'), op('same', 'उस्तै', 'Same'), op('down', 'घटेको', 'Decreased'), dk] }),
        F('visitors_lake', 'yn', t('तालको अवस्थाले पर्यटक संख्यामा असर गर्छ?', 'Does the lake’s condition affect visitor numbers?')),
        F('culture', 'textarea', t('तालसँग जोडिएका चाडपर्व, पूजा, मेला, विश्वास वा कथाहरू', 'Festivals, rituals, fairs, beliefs or stories connected with the lake'), { hint: t('पुराना कथाले तालको उमेर र पहिलेको अवस्था बुझ्न मद्दत गर्न सक्छन्।', 'Old stories can reveal the lake’s age and former state.') }),
        F('biodiversity', 'grid', t('तालका जीवजन्तु र वनस्पतिमा परिवर्तन', 'Changes in lake wildlife and plants'), { scale: O.trend, cols: [op('chg', 'परिवर्तन', 'Change')],
          rows: [op('fish', 'माछा', 'Fish'), op('frogs', 'भ्यागुता', 'Frogs'), op('birds', 'पानीचरा', 'Water birds'), op('leeches', 'जुका', 'Leeches'), op('plants', 'जलीय वनस्पति / कमल', 'Aquatic plants / lotus'), op('mosquito', 'लामखुट्टे', 'Mosquitoes')] }),
        F('most_affected', 'checks', t('तालको पानी घट्दा सबैभन्दा बढी कसलाई असर परेको छ?', 'Who is most affected by the decline?'), { options: [
          op('women', 'महिला', 'Women'), op('children', 'बालबालिका', 'Children'), op('elderly', 'ज्येष्ठ नागरिक', 'Elderly'), op('herders', 'पशुपालक परिवार', 'Livestock-keeping households'),
          op('homestay', 'होमस्टे परिवार', 'Homestay households'), op('farmers', 'किसान', 'Farmers'), op('marginal', 'दलित / सीमान्तकृत परिवार', 'Dalit / marginalised households'),
          op('poor', 'गरिब परिवार', 'Poor households'), op('none', 'कोही विशेष होइन', 'No one in particular')] }),
      ] },

      { id: 'N', title: t('सम्भावित कारण र प्राथमिकता', 'Likely causes and priorities'), show: ['consent', 'yes'],
        note: t('हरेक कारण एउटै तटस्थ स्वरमा पढ्नुहोस्। पहिले सबैलाई मूल्याङ्कन गराउनुहोस्, त्यसपछि शीर्ष तीन छान्न लगाउनुहोस्।', 'Read every cause in the same neutral tone. First have each one rated, then ask for the top three.'),
        fields: [
          F('cause_rate', 'grid', t('प्रत्येक कारणलाई “मुख्य / सहायक / सम्भावना कम / थाहा छैन” मा राख्नुहोस्।', 'Rate each cause: main / contributing / unlikely / don’t know.'), { ref: 62, rows: O.causes, cols: [op('r', 'मूल्याङ्कन', 'Rating')], scale: O.causeRate }),
          F('cause_rank', 'rank', t('तपाईंलाई सबैभन्दा सम्भावित तीन कारण कुन लाग्छन्? क्रम १–३ मा राख्नुहोस्।', 'Which three causes seem most likely? Rank 1–3.'), { ref: 61, max: 3, options: O.causes }),
          F('cause_evidence', 'textarea', t('पहिलो कारणलाई समर्थन गर्ने सबैभन्दा बलियो प्रमाण के हो?', 'What is the strongest evidence for your first-ranked cause?'), { ref: 63, evidence: true }),
          F('cause_falsify', 'textarea', t('कस्तो प्रमाण भेटिएमा तपाईंको धारणा गलत पनि हुन सक्छ?', 'What evidence would show your view might be wrong?'), { ref: 64 }),
          F('actions_now', 'checks', t('ताल जोगाउन तुरुन्त के गर्नुपर्छ जस्तो लाग्छ?', 'What should be done now to protect the lake?'), { ref: 65, other: true, options: [
            op('repair', 'चुहावट / चिरा मर्मत', 'Repair leaks / cracks'), op('reopen', 'पुराना पानी आउने बाटो / नाली खोल्ने', 'Re-open old inflow paths / drains'),
            op('weep', 'कंक्रिट हटाउने वा पानी छिर्ने प्वाल राख्ने', 'Remove concrete or add openings'), op('clay', 'माटो (क्ले) ले लिप्ने', 'Clay lining / plastering'),
            op('desilt', 'गेग्रान झिक्ने', 'De-silting'), op('recharge', 'माथि पुनर्भरण पोखरी / खाल्डो', 'Recharge ponds / trenches upslope'), op('plant', 'वृक्षारोपण / वनस्पति', 'Planting / vegetation'),
            op('stop_use', 'पानी निकासी रोक्ने', 'Stop water extraction'), op('monitor', 'नियमित अनुगमन', 'Regular monitoring'), op('committee', 'संरक्षण समिति', 'Conservation committee'),
            op('study', 'पहिले प्राविधिक अध्ययन', 'Technical study first'), other] }),
          F('actions_priority', 'textarea', t('सबैभन्दा पहिले कुन काम, र किन?', 'Which one first, and why?')),
          F('study_needs', 'textarea', t('विस्तृत अध्ययनमा के-के जाँच्नुपर्छ जस्तो लाग्छ?', 'What should the detailed study examine?'), { ref: 65 }),
          F('refer', 'textarea', t('यसबारे अरू कोसँग कुरा गर्नुपर्छ? (ज्येष्ठ नागरिक, डकर्मी, ठेकेदार, वडा सदस्य)', 'Who else should we talk to? (elders, masons, contractors, ward members)'), { pii: true }),
        ] },

      { id: 'O', title: t('फिल्डमा देखाइएका ठाउँहरू', 'Places shown in the field'), show: ['consent', 'yes'],
        intro: t('सम्भव भए उत्तरदातासँगै हिँडेर उहाँले देखाएका प्रत्येक ठाउँ दर्ता गर्नुहोस्।', 'If possible walk with the respondent and record every place they point out.'),
        fields: [
          F('points', 'table', t('देखाइएका ठाउँहरू', 'Points shown'), { minRows: 3, printRows: 6, columns: [
            F('type', 'select', null, { label: t('प्रकार', 'Type'), options: [
              op('shore', 'पुरानो किनार / अधिकतम सतह', 'Old shoreline / high water'), op('inflow', 'पहिले पानी आउने बाटो', 'Former inflow path'), op('blocked', 'बन्द भएको बाटो', 'Blocked path'),
              op('seep', 'चुहावट / भिजेको ठाउँ', 'Seepage / wet spot'), op('crack', 'चिरा', 'Crack'), op('spring', 'मुहान', 'Spring'), op('outlet', 'निकास / ओभरफ्लो', 'Outlet / overflow'),
              op('sediment', 'गेग्रान आउने ठाउँ', 'Sediment source'), op('photo', 'पुरानो फोटो खिचिएको ठाउँ', 'Old photo viewpoint'), other] }),
            F('desc', 'text', null, { label: t('विवरण', 'Description') }),
            F('gps', 'gps', null, { label: t('GPS') }),
            F('photo', 'text', null, { label: t('फोटो ID', 'Photo ID') }),
          ] }),
          F('points_photos', 'photos', t('ती ठाउँहरूका फोटो (क्याप्सनमा पङ्क्ति नम्बर लेख्नुहोस्)', 'Photos of the points (write the row number in each caption)'), { show: ['consent_photo', 'yes'] }),
        ] },

      { id: 'P', title: t('अन्तर्वार्ता समापन (सर्वेक्षकले भर्ने)', 'Closing (enumerator only)'), fields: [
        F('end', 'datetime', t('समाप्ति समय', 'End time'), { hint: t('“Complete” थिच्दा खाली भए आफैँ भरिन्छ।', 'Filled automatically on “Complete” if empty.') }),
        F('reliability', 'radio', t('तालको इतिहासबारे उत्तरदाताको जानकारी (सर्वेक्षकको मूल्याङ्कन)', 'Respondent’s knowledge of lake history (enumerator judgement)'), { show: ['consent', 'yes'], options: [
          op('high', 'उच्च', 'High'), op('medium', 'मध्यम', 'Medium'), op('low', 'न्यून', 'Low')] }),
        F('influenced', 'yn', t('उपस्थित अरू व्यक्तिले उत्तरमा प्रभाव पारे?', 'Did others present influence the answers?'), { show: ['consent', 'yes'], dk: false }),
        F('quotes', 'textarea', t('महत्त्वपूर्ण भनाइ (शब्दशः)', 'Key verbatim quotes'), { show: ['consent', 'yes'] }),
        F('followup', 'textarea', t('पछि गर्नुपर्ने काम (फोटो संकलन, ठाउँ भ्रमण, व्यक्तिसँग भेट)', 'Follow-up needed (photos to collect, places to visit, people to meet)')),
        F('i_thanks', 'info', null, { text: t('तपाईंको समय र जानकारीका लागि धेरै धन्यवाद। अध्ययनको नतिजा समुदायसँग साझा गरिनेछ।', 'Thank you for your time and information. The findings will be shared with the community.') }),
      ] },
    ],
  });

  /* ======================= KII: key-informant interview ======================= */
  const kq = (id, ne, en, hint, x = {}) => F(id, 'textarea', t(ne, en), { hint, evidence: true, rows: 4, ...x });
  TT.registerForm({
    id: 'kii', short: 'KII', version: 1, group: 'community', icon: 'message', geo: 'loc', target: 10, targetLabel: 'interviews',
    title: t('मुख्य सूचनादाता अन्तर्वार्ता', 'Key-informant interview'),
    purpose: t('वडा/गाउँपालिका प्रतिनिधि, ज्येष्ठ नागरिक, निर्माणमा संलग्न व्यक्ति, संरक्षणकर्मी र होमस्टे सञ्चालकसँग गहिरो कुराकानी — निर्माणको इतिहास, अभिलेख र समयरेखा पत्ता लगाउन।',
      'In-depth interviews with ward/municipal representatives, elders, construction personnel, conservation workers and homestay operators to recover construction history, records and a dated timeline.'),
    summary: (v) => [TT.optLabel(TT.FORMS.kii.fieldMap.role, v.role || ''), v.org].filter(Boolean).join(' · '),
    sections: [
      { id: 'A', title: t('अन्तर्वार्ता विवरण र सहमति', 'Interview details & consent'), fields: [
        ...meta(),
        F('i_consent', 'info', null, { text: t('अध्ययनको उद्देश्य बताउनुहोस्, सहभागिता स्वैच्छिक भएको र पदीय भनाइ उद्धृत गर्नुअघि अनुमति लिइने कुरा स्पष्ट गर्नुहोस्।', 'Explain the purpose; participation is voluntary; ask permission before quoting anyone in an official capacity.') }),
        F('consent', 'yn', t('सहमति प्राप्त?', 'Consent obtained?'), { dk: false, required: true }),
        F('quote_ok', 'radio', t('भनाइ कसरी उद्धृत गर्न सकिन्छ?', 'How may statements be attributed?'), { show: ['consent', 'yes'], options: [
          op('name', 'नाम र पदसहित', 'With name and position'), op('role', 'पद मात्र', 'Role only'), op('anon', 'गोप्य', 'Anonymous')] }),
      ] },
      { id: 'B', title: t('सूचनादाताको विवरण', 'Informant'), show: ['consent', 'yes'], fields: [
        F('name', 'text', t('नाम', 'Name'), { pii: true }),
        F('role', 'select', t('भूमिका', 'Role'), { other: true, required: true, options: [
          op('ward', 'वडाध्यक्ष / वडा सदस्य', 'Ward chair / member'), op('rm', 'गाउँपालिका अधिकारी / इन्जिनियर', 'Municipal official / engineer'),
          op('forest', 'डिभिजन वन / भू-संरक्षण कार्यालय', 'Division Forest / soil conservation office'), op('contractor', 'ठेकेदार / निर्माण व्यवसायी', 'Contractor'),
          op('mason', 'डकर्मी / निर्माण मजदुर', 'Mason / construction worker'), op('committee', 'उपभोक्ता / ताल संरक्षण समिति', 'User / lake conservation committee'),
          op('homestay', 'होमस्टे / पर्यटन सञ्चालक', 'Homestay / tourism operator'), op('elder', 'ज्येष्ठ नागरिक / लामो समयदेखिको बासिन्दा', 'Elder / long-term resident'),
          op('teacher', 'शिक्षक / स्थानीय इतिहासकार', 'Teacher / local historian'), op('religious', 'धार्मिक अगुवा', 'Religious leader'), other] }),
        F('org', 'text', t('संस्था / पद', 'Organisation / position')),
        F('years_involved', 'integer', t('ताल वा यस क्षेत्रसँग कति वर्षदेखि सम्बन्धित?', 'Years associated with the lake / area'), { min: 0, max: 100 }),
        F('phone', 'text', t('सम्पर्क नम्बर (अनुमति भए)', 'Contact (with permission)'), { pii: true }),
      ] },
      { id: 'C', title: t('मुख्य प्रश्नहरू (प्रतिवेदन खण्ड १४)', 'Core guide (report section 14)'), show: ['consent', 'yes'], fields: [
        kq('k1', '२०७२ भन्दा अघिदेखि हालसम्म तालमा भएका मुख्य परिवर्तनहरूको समयरेखा बताइदिनुहोस्।', 'Please reconstruct a timeline of major changes to the lake from before 2015 to the present.', t('हरेक घटनाको साल सोध्नुहोस्; खण्ड E को तालिकामा पनि टिप्नुहोस्।', 'Ask the year of each event; also enter them in the timeline table (section E).'), { ref: 1 }),
        kq('k2', 'ताल वरिपरि के-कस्ता इन्जिनियरिङ/संरक्षणका काम भएका छन्? वर्ष, निकाय, ठेकेदार, नक्सा, बजेट/BOQ र ठ्याक्कै स्थान बताइदिनुहोस्।', 'What engineering or conservation works have been done around the lake? Give year, agency, contractor, drawings, budget/BOQ and exact location.', t('खण्ड D को तालिकामा प्रत्येक काम छुट्टै पङ्क्तिमा भर्नुहोस्।', 'Enter each work as a row in the table in section D.'), { ref: 2 }),
        kq('k3', 'तालको गहिराइ, क्षेत्रफल, भण्डारण वा चुहावटको कहिल्यै सर्वेक्षण भएको थियो? अभिलेख कोसँग छ?', 'Was the lake ever surveyed for depth, area, storage or seepage? Who has the records?', null, { ref: 3 }),
        kq('k4', 'कंक्रिट / किनार lining किन रोजियो? कुन समस्या समाधान गर्न खोजिएको थियो?', 'Why was concrete / edge lining selected? What problem was it meant to solve?', null, { ref: 4 }),
        kq('k5', 'खन्ने काम गर्दा प्राकृतिक पानी आउने बाटो, नाली, मुहान वा भिजेको माटो देखिएको थियो?', 'During excavation, were natural inflow paths, drains, springs or wet soil zones observed?', t('माटोको प्रकार, चट्टान, पानी रसाएको गहिराइ सोध्नुहोस्।', 'Probe: soil type, rock, depth at which water seeped in.'), { ref: 5 }),
        kq('k6', 'कुनै निकास/overflow नाली बनाइयो, बन्द गरियो, अग्लो पारियो वा मर्मत गरियो?', 'Was any outlet or overflow drain built, closed, raised or repaired?', null, { ref: 6 }),
        kq('k7', '२०७२ को भूकम्पले ताल क्षेत्रमा देखिने क्षति पुर्‍यायो? चिराहरू नक्साङ्कन वा मर्मत गरिए?', 'Did the 2015 earthquake visibly damage the lake area? Were cracks mapped or repaired?', null, { ref: 7 }),
        kq('k8', 'पुनर्भरण पोखरीहरू कहाँ बनाइए? तिनीहरू तालसँग पानीको बाटोले जोडिएका छन्?', 'Where were recharge ponds placed, and are they hydrologically connected to the lake?', null, { ref: 8 }),
        kq('k9', 'वर्षा, पानीको सतह वा मर्मतसम्भारको कुनै अभिलेख छ?', 'Are there rainfall, water-level or maintenance records?', null, { ref: 9 }),
        kq('k10', 'तालभन्दा तलका मुहान/कुवामा पनि तालसँगै परिवर्तन आएको छ?', 'Have downslope springs or wells changed at the same time as the lake?', null, { ref: 10 }),
        kq('k11', 'पुनर्भरण वा संरक्षण कार्यलाई असर गर्ने विवाद वा जग्गा स्वामित्वको समस्या छ?', 'Are there disputes or land-ownership constraints that affected recharge or conservation works?', null, { ref: 11 }),
        kq('k12', 'अहिले कुन अध्ययन वा काम पहिले गर्नुपर्छ, र किन?', 'What study or intervention would you prioritise now, and why?', null, { ref: 12 }),
      ] },
      { id: 'D', title: t('निर्माण कार्य र अभिलेख', 'Works and records'), show: ['consent', 'yes'], fields: [
        F('works', 'table', t('ताल वरिपरिका कामहरू', 'Works around the lake'), { minRows: 2, printRows: 6, columns: [
          F('work', 'text', null, { label: t('काम', 'Work') }),
          F('year', 'bsyear', null, { label: t('साल (BS)', 'Year BS'), from: nowYear, to: 2030 }),
          F('agency', 'text', null, { label: t('निकाय', 'Agency') }),
          F('contractor', 'text', null, { label: t('ठेकेदार / समिति', 'Contractor / committee') }),
          F('cost', 'number', null, { label: t('लागत (रु.)', 'Cost (NPR)') }),
          F('docs', 'select', null, { label: t('कागजात', 'Documents'), options: [op('drawings', 'नक्सा', 'Drawings'), op('boq', 'BOQ / इस्टिमेट', 'BOQ / estimate'), op('report', 'प्रतिवेदन', 'Report'), op('none', 'छैन', 'None'), dk] }),
          F('where', 'text', null, { label: t('स्थान', 'Location') }),
          F('gps', 'gps', null, { label: t('GPS') }),
        ] }),
        F('records_avail', 'checks', t('कुन अभिलेख उपलब्ध छन्?', 'Which records exist?'), { options: [
          op('drawings', 'नक्सा / ड्रइङ', 'Drawings'), op('boq', 'BOQ / लागत इस्टिमेट', 'BOQ / cost estimate'), op('completion', 'कार्यसम्पन्न प्रतिवेदन', 'Completion report'),
          op('photos', 'फोटो', 'Photos'), op('survey', 'गहिराइ / सर्वेक्षण अभिलेख', 'Depth / survey records'), op('level', 'पानीको सतहको अभिलेख', 'Water-level records'),
          op('rain', 'वर्षाको अभिलेख', 'Rainfall records'), op('minutes', 'बैठक निर्णय', 'Meeting minutes'), op('none', 'केही छैन', 'None')] }),
        F('records_where', 'textarea', t('अभिलेख कोसँग छन्, कसरी पाउन सकिन्छ?', 'Who holds them and how can copies be obtained?')),
        F('docs_photos', 'photos', t('कागजातको फोटो (अनुमति लिएर)', 'Photos of documents (with permission)')),
      ] },
      { id: 'E', title: t('समयरेखा', 'Timeline'), show: ['consent', 'yes'], fields: [
        F('timeline', 'table', t('घटना र तालमा असर', 'Events and effect on the lake'), { minRows: 5, printRows: 10, columns: [
          F('year', 'bsyear', null, { label: t('साल (BS)', 'Year BS'), from: nowYear, to: 2020 }),
          F('event', 'text', null, { label: t('घटना', 'Event') }),
          F('effect', 'select', null, { label: t('तालमा असर', 'Effect on lake'), options: [op('down', 'पानी घट्यो', 'Level fell'), op('up', 'पानी बढ्यो', 'Level rose'), op('none', 'परिवर्तन छैन', 'No change'), dk] }),
          F('certainty', 'select', null, { label: t('आधार', 'Basis'), options: [op('doc', 'कागजात', 'Documented'), op('memory', 'आफ्नो सम्झना', 'Own memory'), op('heard', 'सुनेको', 'Heard')] }),
        ] }),
      ] },
      { id: 'F', title: t('समापन', 'Closing'), fields: [
        F('referrals', 'textarea', t('अरू कोसँग कुरा गर्नुपर्छ?', 'Who else should be interviewed?'), { pii: true }),
        F('followup', 'textarea', t('पछि गर्नुपर्ने काम', 'Follow-up actions')),
        F('reliability', 'radio', t('जानकारीको विश्वसनीयता (सर्वेक्षकको मूल्याङ्कन)', 'Reliability of information (enumerator judgement)'), { options: [op('high', 'उच्च', 'High'), op('medium', 'मध्यम', 'Medium'), op('low', 'न्यून', 'Low')] }),
        F('end', 'datetime', t('समाप्ति समय', 'End time')),
      ] },
    ],
  });

  /* ======================= FGD: focus-group discussion ======================= */
  TT.registerForm({
    id: 'fgd', short: 'FGD', version: 1, group: 'community', icon: 'grid', geo: 'loc', target: 2, targetLabel: 'sessions',
    title: t('समूह छलफल (सहभागितामूलक अभ्यास)', 'Focus-group discussion (participatory exercises)'),
    purpose: t('ज्येष्ठ नागरिक, महिला, पशुपालक र होमस्टे सञ्चालकसँग समूहमा ऐतिहासिक समयरेखा, मौसमी क्यालेन्डर, नक्सा र कारणको अंकन — व्यक्तिगत अन्तर्वार्ता पुष्टि गर्न।',
      'Group exercises with elders, women, herders and homestay operators: historical timeline, seasonal calendar, participatory map and proportional-piling cause scoring, to cross-check individual interviews.'),
    summary: (v) => [v.venue, v.n_total ? v.n_total + ' participants' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: 'A', title: t('सत्र विवरण', 'Session'), fields: [
        ...meta([
          F('venue', 'text', t('स्थान', 'Venue')),
          F('notetaker', 'text', t('टिपोट गर्ने', 'Note-taker')),
          F('n_total', 'integer', t('कुल सहभागी', 'Participants (total)'), { min: 3, max: 60 }),
          F('n_women', 'integer', t('महिला सहभागी', 'Women'), { min: 0, max: 60 }),
          F('n_elder', 'integer', t('६० वर्षमाथिका', 'Aged 60+'), { min: 0, max: 60 }),
          F('composition', 'checks', t('समूहको बनोट', 'Group composition'), { options: [
            op('elders', 'ज्येष्ठ नागरिक', 'Elders'), op('women', 'महिला', 'Women'), op('herders', 'पशुपालक', 'Herders'), op('farmers', 'किसान', 'Farmers'),
            op('homestay', 'होमस्टे सञ्चालक', 'Homestay operators'), op('youth', 'युवा', 'Youth'), op('committee', 'समिति सदस्य', 'Committee members'), op('mixed', 'मिश्रित', 'Mixed')] }),
          F('consent', 'yn', t('समूहबाट मौखिक सहमति', 'Verbal consent from the group'), { dk: false, required: true }),
        ]),
      ] },
      { id: 'B', title: t('अभ्यास १: ऐतिहासिक समयरेखा', 'Exercise 1: historical timeline'), show: ['consent', 'yes'],
        intro: t('चार्ट पेपरमा सबैभन्दा पुरानो सम्झनादेखि आजसम्म रेखा कोर्नुहोस्। घटना र तालको अवस्था समूहको सहमतिमा राख्नुहोस्।', 'Draw a line on chart paper from the earliest memory to today. Place events and lake condition by group agreement.'),
        fields: [
          F('timeline', 'table', t('समयरेखा', 'Timeline'), { minRows: 6, printRows: 12, columns: [
            F('year', 'bsyear', null, { label: t('साल (BS)', 'Year BS'), from: nowYear, to: 2010 }),
            F('event', 'text', null, { label: t('घटना', 'Event') }),
            F('level', 'select', null, { label: t('तालको अवस्था', 'Lake condition'), options: O.level5 }),
            F('agree', 'select', null, { label: t('सहमति', 'Agreement'), options: [op('all', 'सबै सहमत', 'Consensus'), op('most', 'अधिकांश', 'Majority'), op('disputed', 'विवादित', 'Disputed')] }),
          ] }),
          F('timeline_photo', 'photos', t('चार्टको फोटो', 'Photo of the chart')),
        ] },
      { id: 'C', title: t('अभ्यास २: मौसमी क्यालेन्डर', 'Exercise 2: seasonal calendar'), show: ['consent', 'yes'], fields: [
        F('seasonal', 'grid', t('समूहको सहमतिमा हरेक महिनाको पानीको अवस्था', 'Lake level in each month, by group agreement'), { rows: O.months, levelColors: true, scale: O.level5,
          cols: [op('before', 'पहिले (घट्नुअघि)', 'Before the decline'), op('now', 'अहिले', 'Now')] }),
        F('seasonal_notes', 'textarea', t('छलफलका मुख्य बुँदा', 'Discussion points')),
      ] },
      { id: 'D', title: t('अभ्यास ३: सहभागितामूलक नक्सा', 'Exercise 3: participatory map'), show: ['consent', 'yes'],
        intro: t('ताल, पानी आउने बाटो, पुराना किनारा, सडक, नाली, मुहान, चुहावट र निर्माण कार्य समूहलाई नै नक्सामा कोर्न लगाउनुहोस्।', 'Ask the group to draw the lake, inflow paths, old shorelines, roads, drains, springs, seepage and works.'),
        fields: [
          F('map_photo', 'photos', t('नक्साको फोटो', 'Photo of the map')),
          F('map_desc', 'textarea', t('नक्साले देखाएका मुख्य कुरा', 'What the map shows')),
          F('map_points', 'table', t('फिल्डमा पुष्टि गरिएका ठाउँ', 'Places verified on the ground'), { minRows: 2, printRows: 6, columns: [
            F('what', 'text', null, { label: t('के', 'What') }),
            F('gps', 'gps', null, { label: t('GPS') }),
            F('note', 'text', null, { label: t('टिप्पणी', 'Note') }),
          ] }),
        ] },
      { id: 'E', title: t('अभ्यास ४: कारणको अंकन (२० ढुंगा)', 'Exercise 4: cause scoring (20 stones)'), show: ['consent', 'yes'],
        intro: t('समूहलाई २० वटा ढुंगा/गेडागुडी दिनुहोस् र सम्भावित कारणहरूमा तिनको महत्त्वअनुसार बाँड्न लगाउनुहोस्।', 'Give the group 20 stones or beans to distribute among the causes in proportion to their importance.'),
        fields: [
          F('piling', 'table', t('कारण र अंक', 'Causes and scores'), { minRows: 6, printRows: 10, columns: [
            F('cause', 'select', null, { label: t('कारण', 'Cause'), options: O.causes }),
            F('stones', 'integer', null, { label: t('ढुंगा', 'Stones'), min: 0, max: 20 }),
            F('pct', 'number', null, { label: t('%', '%'), computed: true, dp: 0 }),
            F('why', 'text', null, { label: t('मुख्य तर्क', 'Main argument') }),
          ],
          compute: (rows) => { const tot = rows.reduce((s, r) => s + (TT.num(r.stones) || 0), 0); return rows.map((r) => ({ pct: tot && TT.num(r.stones) != null ? (100 * TT.num(r.stones)) / tot : null })); },
          summary: (rows) => { const tot = rows.reduce((s, r) => s + (TT.num(r.stones) || 0), 0); return [['Total stones', String(tot), tot === 20 ? 'ok' : tot ? 'warn' : '']]; } }),
          F('disagree', 'textarea', t('असहमतिका बुँदा', 'Points of disagreement')),
        ] },
      { id: 'F', title: t('अभ्यास ५: समाधानको प्राथमिकता', 'Exercise 5: priority actions'), show: ['consent', 'yes'], fields: [
        F('actions', 'table', t('प्रस्तावित काम', 'Proposed actions'), { minRows: 4, printRows: 8, columns: [
          F('action', 'text', null, { label: t('काम', 'Action') }),
          F('rank', 'integer', null, { label: t('प्राथमिकता', 'Priority'), min: 1, max: 20 }),
          F('who', 'text', null, { label: t('कसले गर्ने', 'Who should act') }),
          F('concern', 'text', null, { label: t('चिन्ता / जोखिम', 'Concerns / risks') }),
        ] }),
      ] },
      { id: 'G', title: t('संश्लेषण', 'Synthesis'), fields: [
        F('agreements', 'textarea', t('मुख्य सहमति', 'Main points of agreement')),
        F('quotes', 'textarea', t('महत्त्वपूर्ण भनाइ', 'Key quotes')),
        F('photos', 'photos', t('सत्रका फोटो', 'Session photos')),
        F('followup', 'textarea', t('पछि गर्नुपर्ने काम', 'Follow-up')),
        F('end', 'datetime', t('समाप्ति समय', 'End time')),
      ] },
    ],
  });

  /* ======================= EV: historical evidence register ======================= */
  TT.registerForm({
    id: 'ev', short: 'EV', version: 1, group: 'community', icon: 'archive', geo: 'viewpoint', target: 10, targetLabel: 'items',
    title: t('ऐतिहासिक प्रमाण दर्ता (पुराना फोटो, कागजात)', 'Historical evidence register (old photos, documents)'),
    purpose: t('पुराना फोटो, भिडियो, कागजात, नक्सा र समाचारको दर्ता — मिति, स्रोत, र सोही ठाउँबाट दोहोर्‍याएर खिचिएको फोटोसहित।',
      'Register of old photos, videos, documents, maps and news items, with date, source and a repeat photo from the same viewpoint.'),
    summary: (v) => [TT.optLabel(TT.FORMS.ev.fieldMap.item_type, v.item_type || ''), v.item_year && v.item_year !== 'dk' ? v.item_year + ' BS' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: 'A', title: t('वस्तुको विवरण', 'Item'), fields: [
        F('enum', 'text', t('दर्ता गर्ने', 'Logged by'), { default: (ctx) => ctx.settings.enumerator || '' }),
        F('item_type', 'radio', t('प्रकार', 'Type'), { required: true, other: true, options: [
          op('photo', 'फोटो', 'Photo'), op('video', 'भिडियो', 'Video'), op('document', 'कागजात', 'Document'), op('map', 'नक्सा / ड्रइङ', 'Map / drawing'),
          op('news', 'समाचार / प्रतिवेदन', 'News / report'), op('boq', 'BOQ / इस्टिमेट', 'BOQ / estimate'), other] }),
        F('item_year', 'bsyear', t('वस्तुको साल', 'Year of the item'), { to: 2000 }),
        F('item_date', 'text', t('ठ्याक्कै मिति / महिना (थाहा भए)', 'Exact date or month (if known)'), { ph: 'e.g. 2068 Kartik / 2011-10' }),
        F('date_basis', 'radio', t('मितिको आधार', 'Basis of the date'), { options: [
          op('written', 'लेखिएको / डिजिटल मिति', 'Written / digital timestamp'), op('event', 'घटनासँग जोडेर', 'Linked to an event'), op('approx', 'अनुमानित', 'Approximate'), op('guess', 'अड्कल', 'Guess')] }),
        F('source', 'text', t('स्रोत व्यक्ति / संस्था', 'Source person / organisation'), { pii: true }),
        F('what', 'textarea', t('यसले के देखाउँछ?', 'What does it show?'), { required: true }),
        F('level', 'select', t('त्यसमा देखिएको पानीको अवस्था', 'Water condition visible in the item'), { options: O.level5 }),
        F('landmark', 'textarea', t('तुलना गर्न मिल्ने चिनारी (ढुंगा, रुख, घर, पर्खाल)', 'Landmarks usable for comparison (stone, tree, house, wall)')),
        F('copy', 'photos', t('वस्तुको फोटो / स्क्यान', 'Photo or scan of the item'), { required: true }),
        F('viewpoint', 'gps', t('फोटो खिचिएको ठाउँ (सोही ठाउँमा उभिएर)', 'Viewpoint of the original photo (stand on the same spot)')),
        F('repeat_photo', 'photos', t('आज सोही ठाउँबाट खिचिएको फोटो', 'Repeat photo taken today from the same viewpoint')),
        F('permission', 'radio', t('प्रयोगको अनुमति', 'Permission to use'), { required: true, options: [
          op('report', 'प्रतिवेदनमा प्रयोग गर्न सकिने', 'May be used in the report'), op('internal', 'आन्तरिक विश्लेषणका लागि मात्र', 'Internal analysis only'), op('no', 'अनुमति छैन', 'Not permitted')] }),
        F('returned', 'yn', t('सक्कल प्रति धनीलाई फिर्ता गरियो?', 'Original returned to the owner?'), { dk: false }),
        F('notes', 'textarea', t('टिप्पणी', 'Notes')),
      ] },
    ],
  });
})();
