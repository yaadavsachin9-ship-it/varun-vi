/**
 * Bilingual UI strings for the citizen-facing screens.
 *
 * The control-room dashboard stays English -- it is used by trained EOC staff. The citizen
 * view is the opposite: it is read by the people being asked to leave their homes, so Hindi
 * is a first-class language here, not a bolt-on. Hindi is in fact the DEFAULT for the
 * citizen route, with English available as a toggle.
 *
 * Alert bodies themselves are NOT translated in the browser -- the backend generates both
 * language variants server-side (backend/alert_service.py) so the SMS, the CAP payload and
 * the screen all carry byte-identical wording. This file only covers UI chrome.
 */

export const LANGS = ['hi', 'en'];

const STRINGS = {
  en: {
    appName: 'VARUN',
    tagline: 'Flash Flood Early Warning',
    chooseVillage: 'Choose your village',
    searchPlaceholder: 'Search village or district',
    myVillage: 'My village',
    riskNow: 'Risk right now',
    safe: 'Safe',
    watch: 'Be alert',
    danger: 'Danger — leave now',
    outOf: 'out of 100',
    timeAvailable: 'Time you have',
    hours: 'hours',
    minutes: 'minutes',
    whatToDo: 'What to do now',
    whereToGo: 'Where to go',
    walkTime: 'On foot',
    climb: 'Climb',
    capacity: 'Capacity',
    people: 'people',
    callHelp: 'Call for help',
    helpline: 'Helpline 1070',
    otherShelters: 'Other shelters',
    noShelter: 'No shelter is registered yet for this village.',
    cause: 'Main cause',
    rainfall: 'Rainfall',
    soilWater: 'Soil water',
    streamLevel: 'Stream level',
    lastUpdate: 'Last update',
    offline: 'Showing last saved data — you are offline',
    installApp: 'Install on phone',
    feasible: 'Reachable in time',
    tight: 'Very little time — do not delay',
    notFeasible: 'Too far to walk — ask for a vehicle',
    crossesStream: 'This route crosses the stream. Cross only if the bed is dry.',
    belowVillage:
      'This shelter is lower than your village. Flood water and debris also travel downhill. Go there only if there is nothing higher you can reach.',
    minSpare: 'min to spare',
    minShort: 'min short',
    downhill: 'below',
    change: 'Change',
    back: 'Back',
    liveLabel: 'Live',
    connecting: 'Connecting',
    safeSteps: [
      'Stay where you are. No action needed.',
      'Keep your phone charged and keep this page open.',
      'Know your shelter route before it is needed.',
    ],
    watchSteps: [
      'Pack ID papers, medicines, a torch and drinking water now.',
      'Move livestock to higher ground.',
      'Do not sleep in a room below the road level tonight.',
      'Stay away from the stream bank.',
    ],
    dangerSteps: [
      'Leave for the shelter shown below immediately.',
      'Do not stop to collect belongings.',
      'Do not walk in the stream bed or cross it.',
      'Help elderly neighbours and children first.',
    ],
  },
  hi: {
    appName: 'ड्रेन-गार्ड',
    tagline: 'फ्लैश फ्लड पूर्व चेतावनी',
    chooseVillage: 'अपना गाँव चुनें',
    searchPlaceholder: 'गाँव या जिला खोजें',
    myVillage: 'मेरा गाँव',
    riskNow: 'अभी का खतरा',
    safe: 'सुरक्षित',
    watch: 'सावधान रहें',
    danger: 'खतरा — तुरंत निकलें',
    outOf: '100 में से',
    timeAvailable: 'आपके पास समय',
    hours: 'घंटे',
    minutes: 'मिनट',
    whatToDo: 'अभी क्या करें',
    whereToGo: 'कहाँ जाएँ',
    walkTime: 'पैदल',
    climb: 'चढ़ाई',
    capacity: 'क्षमता',
    people: 'लोग',
    callHelp: 'मदद के लिए कॉल करें',
    helpline: 'हेल्पलाइन 1070',
    otherShelters: 'अन्य राहत शिविर',
    noShelter: 'इस गाँव के लिए अभी कोई राहत शिविर पंजीकृत नहीं है।',
    cause: 'मुख्य कारण',
    rainfall: 'वर्षा',
    soilWater: 'मिट्टी में पानी',
    streamLevel: 'नाले का जलस्तर',
    lastUpdate: 'अंतिम अद्यतन',
    offline: 'पुरानी सहेजी गई जानकारी दिख रही है — आप ऑफ़लाइन हैं',
    installApp: 'फ़ोन में इंस्टॉल करें',
    feasible: 'समय पर पहुँच सकते हैं',
    tight: 'समय बहुत कम है — देर न करें',
    notFeasible: 'पैदल बहुत दूर — वाहन मांगें',
    crossesStream: 'यह रास्ता नाला पार करता है। केवल तभी पार करें जब तल सूखा हो।',
    belowVillage:
      'यह शिविर आपके गाँव से नीचे है। बाढ़ का पानी और मलबा भी नीचे की ओर बहते हैं। इससे ऊँची कोई जगह न मिले तभी यहाँ जाएँ।',
    minSpare: 'मिनट बचेंगे',
    minShort: 'मिनट कम',
    downhill: 'नीचे',
    change: 'बदलें',
    back: 'वापस',
    liveLabel: 'लाइव',
    connecting: 'जुड़ रहा है',
    safeSteps: [
      'जहाँ हैं वहीं रहें। कोई कार्रवाई आवश्यक नहीं।',
      'फ़ोन चार्ज रखें और यह पेज खुला रखें।',
      'ज़रूरत पड़ने से पहले अपने शिविर का रास्ता जान लें।',
    ],
    watchSteps: [
      'पहचान पत्र, दवाइयाँ, टॉर्च और पीने का पानी अभी तैयार रखें।',
      'पशुओं को ऊँची जगह ले जाएँ।',
      'आज रात सड़क से नीचे वाले कमरे में न सोएँ।',
      'नाले के किनारे से दूर रहें।',
    ],
    dangerSteps: [
      'नीचे दिखाए गए राहत शिविर की ओर तुरंत निकलें।',
      'सामान इकट्ठा करने के लिए न रुकें।',
      'नाले के तल में न चलें और उसे पार न करें।',
      'बुज़ुर्गों और बच्चों की पहले मदद करें।',
    ],
  },
};

/** Returns the string table for `lang`, falling back to Hindi (the citizen default). */
export function t(lang) {
  return STRINGS[lang] || STRINGS.hi;
}

/** Risk level -> the localised headline word shown on the big status card. */
export function riskWord(lang, level) {
  const s = t(lang);
  if (level === 'red') return s.danger;
  if (level === 'yellow') return s.watch;
  return s.safe;
}

/** Feasibility verdict from backend/evacuation.py -> localised one-liner. */
export function feasibilityWord(lang, feasibility) {
  const s = t(lang);
  if (feasibility === 'feasible') return s.feasible;
  if (feasibility === 'tight') return s.tight;
  if (feasibility === 'not_feasible_on_foot') return s.notFeasible;
  return '';
}

/**
 * Hindi for the engine's `primary_factor` labels.
 *
 * This deliberately MIRRORS PRIMARY_FACTOR_HI in backend/alert_service.py rather than calling
 * it: the village API returns the English label only, and the citizen screen still has to be
 * readable in Hindi. The two maps must be edited together when the engine gains a new factor.
 * Unmapped phrases pass through unchanged, so a new factor degrades to English instead of
 * disappearing. Alert bodies are NOT affected -- those are still generated server-side.
 */
const FACTOR_HI = {
  'Extreme Cloudburst Intensity': 'अत्यधिक तीव्र बादल फटना',
  'High Soil Moisture Saturation': 'मिट्टी में अत्यधिक जलसंतृप्ति',
  'Debris Flow Vibration Spike': 'मलबा प्रवाह कंपन में उछाल',
  'Steep Slope Gravitational Instability': 'तीव्र ढलान की अस्थिरता',
  'Stream Flood Stage Inundation': 'नाले का जलस्तर बढ़कर बाढ़',
  'Normal Hydrological Baseline': 'सामान्य जल-विज्ञान स्थिति',
  'Normal Hydrological Conditions': 'सामान्य जल-विज्ञान स्थिति',
};

export function factorWord(lang, factor) {
  if (!factor) return '';
  if (lang !== 'hi') return factor;
  return factor
    .split('&')
    .map((p) => p.trim())
    .map((p) => FACTOR_HI[p] || p)
    .join(' और ');
}
