// Spanish → English translation for veterinary osteology labels.
// Used for annotations in the University of León scans. Multi-word phrases
// are matched before single words, so "apófisis espinosa" becomes
// "spinous process" rather than a word-by-word translation.

const PHRASES = {
  // processes
  'apófisis espinosa': 'spinous process',
  'apófisis transversa': 'transverse process',
  'apófisis articular craneal': 'cranial articular process',
  'apófisis articular caudal': 'caudal articular process',
  'apófisis articulares craneales': 'cranial articular processes',
  'apófisis articulares caudales': 'caudal articular processes',
  'apófisis articular': 'articular process',
  'apófisis mamilar': 'mamillary process',
  'apófisis accesoria': 'accessory process',
  'apófisis odontoides': 'dens',
  'apófisis coronoides': 'coronoid process',
  'apófisis condilar': 'condylar process',
  'apófisis ancónea': 'anconeal process',
  'apófisis estiloides': 'styloid process',
  'apófisis xifoides': 'xiphoid process',
  'apófisis cigomática': 'zygomatic process',
  // tubercles, tuberosities, crests, lines
  'tubérculo mayor': 'greater tubercle',
  'tubérculo menor': 'lesser tubercle',
  'tubérculo intermedio': 'intermediate tubercle',
  'tubérculo supraglenoideo': 'supraglenoid tubercle',
  'tubérculo infraglenoideo': 'infraglenoid tubercle',
  'tubérculo dorsal': 'dorsal tubercle',
  'tubérculo ventral': 'ventral tubercle',
  'tuberosidad deltoidea': 'deltoid tuberosity',
  'tuberosidad del radio': 'radial tuberosity',
  'tuberosidad radial': 'radial tuberosity',
  'tuberosidad de la tibia': 'tibial tuberosity',
  'tuberosidad coxal': 'tuber coxae',
  'tuberosidad sacra': 'tuber sacrale',
  'tuberosidad isquiática': 'ischial tuberosity',
  'tuberosidad del olécranon': 'olecranon tuber',
  'tuberosidad redonda mayor': 'teres major tuberosity',
  'tuberosidad redonda menor': 'teres minor tuberosity',
  'cresta ventral': 'ventral crest',
  'cresta sacra media': 'median sacral crest',
  'cresta sacra mediana': 'median sacral crest',
  'cresta sacra lateral': 'lateral sacral crest',
  'cresta sacra intermedia': 'intermediate sacral crest',
  'cresta ilíaca': 'iliac crest',
  'cresta iliaca': 'iliac crest',
  'cresta humeral': 'humeral crest',
  'cresta del tubérculo mayor': 'crest of the greater tubercle',
  'espina de la escápula': 'spine of the scapula',
  'espina escapular': 'scapular spine',
  'espina isquiática': 'ischial spine',
  'línea terminal': 'terminal line',
  // fossae, foramina, notches, grooves
  'fosa supraespinosa': 'supraspinous fossa',
  'fosa infraespinosa': 'infraspinous fossa',
  'fosa subescapular': 'subscapular fossa',
  'fosa del olécranon': 'olecranon fossa',
  'fosa radial': 'radial fossa',
  'fosa supracondílea': 'supracondylar fossa',
  'fosa intercondílea': 'intercondylar fossa',
  'fosa trocantérica': 'trochanteric fossa',
  'fosa del atlas': 'atlantal fossa',
  'fosa alar': 'alar fossa',
  'agujero vertebral lateral': 'lateral vertebral foramen',
  'agujero vertebral': 'vertebral foramen',
  'agujero alar': 'alar foramen',
  'agujero transverso': 'transverse foramen',
  'agujero intervertebral': 'intervertebral foramen',
  'agujero obturado': 'obturator foramen',
  'agujero nutricio': 'nutrient foramen',
  'agujero supratroclear': 'supratrochlear foramen',
  'agujeros sacros dorsales': 'dorsal sacral foramina',
  'agujeros sacros ventrales': 'ventral sacral foramina',
  'agujeros sacros pélvicos': 'pelvic sacral foramina',
  'escotadura vertebral craneal': 'cranial vertebral notch',
  'escotadura vertebral caudal': 'caudal vertebral notch',
  'escotadura alar': 'alar notch',
  'escotadura troclear': 'trochlear notch',
  'escotadura isquiática mayor': 'greater ischiatic notch',
  'escotadura isquiática menor': 'lesser ischiatic notch',
  'escotadura del acetábulo': 'acetabular notch',
  'surco intertubercular': 'intertubercular groove',
  'surco del músculo braquial': 'groove for the brachial muscle',
  'cavidad glenoidea': 'glenoid cavity',
  'fosita costal craneal': 'cranial costal fovea',
  'fosita costal caudal': 'caudal costal fovea',
  'fosita costal de la apófisis transversa': 'costal fovea of the transverse process',
  'fosita costal': 'costal fovea',
  'fosita del diente': 'fovea of the dens',
  'fóvea de la cabeza': 'fovea of the head',
  'fosita de la cabeza': 'fovea of the head',
  // vertebral parts
  'arco dorsal': 'dorsal arch',
  'arco ventral': 'ventral arch',
  'arco vertebral': 'vertebral arch',
  'cuerpo vertebral': 'vertebral body',
  'cabeza vertebral': 'head of the vertebra',
  'fosa vertebral': 'vertebral fossa',
  'cuerpo del hueso': 'body of the bone',
  'ala del atlas': 'wing of the atlas',
  'ala del sacro': 'wing of the sacrum',
  'ala del ilion': 'wing of the ilium',
  'ala del ílion': 'wing of the ilium',
  'promontorio del sacro': 'promontory of the sacrum',
  'canal vertebral': 'vertebral canal',
  'canal sacro': 'sacral canal',
  // long-bone parts
  'cabeza del húmero': 'head of the humerus',
  'cabeza del fémur': 'head of the femur',
  'cabeza del radio': 'head of the radius',
  'cuello del húmero': 'neck of the humerus',
  'cuello del fémur': 'neck of the femur',
  'trocánter mayor': 'greater trochanter',
  'trocánter menor': 'lesser trochanter',
  'tercer trocánter': 'third trochanter',
  'cóndilo medial': 'medial condyle',
  'cóndilo lateral': 'lateral condyle',
  'cóndilo del húmero': 'condyle of the humerus',
  'epicóndilo medial': 'medial epicondyle',
  'epicóndilo lateral': 'lateral epicondyle',
  'tróclea del húmero': 'trochlea of the humerus',
  'tróclea del fémur': 'trochlea of the femur',
  'tróclea del radio': 'trochlea of the radius',
  'labio medial': 'medial lip',
  'labio lateral': 'lateral lip',
  'circunferencia articular': 'articular circumference',
  'espacio interóseo': 'interosseous space',
  'espacio interóseo del antebrazo': 'interosseous space of the forearm',
  'superficie articular': 'articular surface',
  'superficie auricular': 'auricular surface',
  'superficie serrada': 'serrated face',
  'superficie glútea': 'gluteal surface',
  'superficie sacropélvica': 'sacropelvic surface',
  'borde dorsal': 'dorsal border',
  'borde craneal': 'cranial border',
  'borde caudal': 'caudal border',
  'borde medial': 'medial border',
  'borde lateral': 'lateral border',
  'borde ventral': 'ventral border',
  'ángulo craneal': 'cranial angle',
  'ángulo caudal': 'caudal angle',
  'ángulo ventral': 'ventral angle',
  'cartílago escapular': 'scapular cartilage',
  'cartílago xifoides': 'xiphoid cartilage',
  'cartílago costal': 'costal cartilage',
  'hueso coxal': 'hip bone',
  'huesos coxales': 'hip bones',
  'hueso sacro': 'sacrum',
  'vértebras sacras': 'sacral vertebrae',
  'vértebra cervical': 'cervical vertebra',
  'vértebra torácica': 'thoracic vertebra',
  'vértebra lumbar': 'lumbar vertebra',
  'vértebra caudal': 'caudal vertebra',
  'vértebra coccígea': 'coccygeal vertebra',
  'sínfisis pélvica': 'pelvic symphysis',
  'cóndilo occipital': 'occipital condyle',
  'cóndilos occipitales': 'occipital condyles',
  'diente del axis': 'dens of the axis',
  'cúbito y radio': 'radius and ulna',
};

const WORDS = {
  apófisis: 'process', tubérculo: 'tubercle', tuberosidad: 'tuberosity', cresta: 'crest', espina: 'spine',
  fosa: 'fossa', fosita: 'fovea', agujero: 'foramen', agujeros: 'foramina', escotadura: 'notch', surco: 'groove',
  línea: 'line', cabeza: 'head', cuello: 'neck', cuerpo: 'body', borde: 'border', ángulo: 'angle', cara: 'surface',
  superficie: 'surface', cóndilo: 'condyle', epicóndilo: 'epicondyle', tróclea: 'trochlea', trocánter: 'trochanter',
  arco: 'arch', ala: 'wing', alas: 'wings', diente: 'dens', canal: 'canal', cavidad: 'cavity', cartílago: 'cartilage',
  hueso: 'bone', huesos: 'bones', vértebra: 'vertebra', vértebras: 'vertebrae', costilla: 'rib', costillas: 'ribs',
  esternón: 'sternum', escápula: 'scapula', húmero: 'humerus', radio: 'radius', cúbito: 'ulna', fémur: 'femur',
  tibia: 'tibia', peroné: 'fibula', rótula: 'patella', sacro: 'sacrum', atlas: 'atlas', axis: 'axis',
  olécranon: 'olecranon', acetábulo: 'acetabulum', ilion: 'ilium', ílion: 'ilium', isquion: 'ischium', pubis: 'pubis',
  metacarpo: 'metacarpus', metatarso: 'metatarsus', falange: 'phalanx', falanges: 'phalanges', pezuña: 'hoof',
  mano: 'manus', pie: 'pes', carpo: 'carpus', tarso: 'tarsus', caballo: 'horse', bovino: 'cattle', perro: 'dog',
  gato: 'cat', craneal: 'cranial', caudal: 'caudal', dorsal: 'dorsal', ventral: 'ventral', medial: 'medial',
  lateral: 'lateral', proximal: 'proximal', distal: 'distal', palmar: 'palmar', plantar: 'plantar', mayor: 'greater',
  menor: 'lesser', intermedio: 'intermediate', transversa: 'transverse', transverso: 'transverse', espinosa: 'spinous',
  articular: 'articular', articulares: 'articular', costal: 'costal', vertebral: 'vertebral', nutricio: 'nutrient',
  derecho: 'right', derecha: 'right', izquierdo: 'left', izquierda: 'left', y: 'and', o: 'or',
  del: 'of the', de: 'of', la: 'the', el: 'the', los: 'the', las: 'the', con: 'with', para: 'for',
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASE_LIST = Object.keys(PHRASES).sort((a, b) => b.length - a.length);
const PHRASE_RE = new RegExp(`(^|[^\\p{L}])(${PHRASE_LIST.map(escapeRe).join('|')})(?=[^\\p{L}]|$)`, 'giu');
const WORD_RE = /\p{L}+/gu;

function matchCase(src, out) {
  return src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()
    ? out.charAt(0).toUpperCase() + out.slice(1)
    : out;
}

export function translateEs(text) {
  if (!text) return text;
  let out = String(text).replace(PHRASE_RE, (m, pre, phrase) => pre + matchCase(phrase, PHRASES[phrase.toLowerCase()]));
  out = out.replace(WORD_RE, (w) => {
    const t = WORDS[w.toLowerCase()];
    return t ? matchCase(w, t) : w;
  });
  return out.replace(/\bof the the\b/gi, 'of the').replace(/\s{2,}/g, ' ').trim();
}

// Latin (NAV) and German bone names that appear as part names in scans
const PART_NAMES = {
  'os incisivum': 'Incisive bone', 'ossa incisiva': 'Incisive bone', 'zwischenkieferbein': 'Incisive bone', 'os praemaxillare': 'Incisive bone',
  'os nasale': 'Nasal bone', 'ossa nasalia': 'Nasal bone', 'nasenbein': 'Nasal bone',
  'maxilla': 'Maxilla', 'oberkieferbein': 'Maxilla', 'oberkiefer': 'Maxilla',
  'os lacrimale': 'Lacrimal bone', 'tränenbein': 'Lacrimal bone', 'traenenbein': 'Lacrimal bone',
  'os zygomaticum': 'Zygomatic bone', 'jochbein': 'Zygomatic bone',
  'os frontale': 'Frontal bone', 'stirnbein': 'Frontal bone',
  'os parietale': 'Parietal bone', 'scheitelbein': 'Parietal bone',
  'os interparietale': 'Interparietal bone', 'zwischenscheitelbein': 'Interparietal bone',
  'os occipitale': 'Occipital bone', 'hinterhauptsbein': 'Occipital bone', 'hinterhauptbein': 'Occipital bone',
  'os temporale': 'Temporal bone', 'schläfenbein': 'Temporal bone', 'schlaefenbein': 'Temporal bone',
  'os sphenoidale': 'Sphenoid bone', 'os basisphenoidale': 'Basisphenoid bone', 'os praesphenoidale': 'Presphenoid bone', 'keilbein': 'Sphenoid bone',
  'os palatinum': 'Palatine bone', 'gaumenbein': 'Palatine bone',
  'vomer': 'Vomer', 'pflugscharbein': 'Vomer',
  'os pterygoideum': 'Pterygoid bone', 'flügelbein': 'Pterygoid bone', 'fluegelbein': 'Pterygoid bone',
  'os ethmoidale': 'Ethmoid bone', 'siebbein': 'Ethmoid bone',
  'mandibula': 'Mandible', 'unterkiefer': 'Mandible', 'unterkieferbein': 'Mandible',
  'apparatus hyoideus': 'Hyoid apparatus', 'zungenbein': 'Hyoid apparatus',
  'hueso frontal': 'Frontal bone', 'hueso parietal': 'Parietal bone', 'hueso occipital': 'Occipital bone',
  'hueso temporal': 'Temporal bone', 'hueso nasal': 'Nasal bone', 'hueso incisivo': 'Incisive bone',
  'hueso lagrimal': 'Lacrimal bone', 'hueso cigomático': 'Zygomatic bone', 'hueso palatino': 'Palatine bone',
  'hueso esfenoides': 'Sphenoid bone', 'hueso etmoides': 'Ethmoid bone', 'hueso maxilar': 'Maxilla', 'maxilar': 'Maxilla',
  'dentes': 'Teeth', 'zähne': 'Teeth', 'zaehne': 'Teeth',
};

// Turns a raw part/material name from a scan into a readable English label, or null if it looks generic
export function partLabel(raw) {
  const clean = String(raw || '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b(mat|material|mtl)\b/gi, '')
    .replace(/\s*\d+$/, '')
    .trim();
  if (!clean || clean.length < 3) return null;
  if (/^(default|lambert|phong|standard|blinn|scene|object|mesh|root|texture|none|initialshading)/i.test(clean)) return null;
  const known = PART_NAMES[clean.toLowerCase()];
  if (known) return known;
  const t = translateEs(clean);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
