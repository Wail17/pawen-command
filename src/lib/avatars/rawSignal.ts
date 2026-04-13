// ============================================================
// PAWEN — Raw Signal Extractor
// Deterministic, NO LLM. Takes the raw scraped data from Phase 2
// (before any analyzer touches it) and builds:
//   - a preserved verbatim corpus (items, never filtered, never LLM-processed)
//   - n-gram frequency tables (1/2/3/4-grams with source-diversity count)
//   - emotion-marker hits (regex-based)
//   - top phrases (4-6 word motifs)
//
// The goal: even if the LLM compile phase hallucinates, loses nuggets,
// or over-summarizes, the raw signal stays preserved and searchable in
// the UI. The user picks golden nuggets here and they stack into
// raw_signal.picks, visible to every downstream gate.
// ============================================================

import type {
  RawSourceData,
  SourceType,
  RawSignal,
  RawSignalItem,
  NgramStat,
  EmotionMarkerHit,
  EmotionCategoryV2,
  IdentityMarkerHit,
  BuyingSignalHit,
  ScoredPhrase,
} from './types';

// -------- Stopwords (multi-lang, light touch) --------
// Kept small on purpose — aggressive stopwording destroys n-grams like
// "I can't sleep" or "all the time" that are goldmine motifs.

const STOPWORDS: Record<string, Set<string>> = {
  en: new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'from', 'by',
    'for', 'with', 'as', 'this', 'that', 'these', 'those', 'it', 'its',
    'so', 'not', 'no', 'yes', 'do', 'does', 'did', 'done', 'have', 'has',
    'had', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
    'am', 'me', 'my', 'you', 'your', 'yours', 'he', 'she', 'we', 'us',
    'our', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
    'just', 'then', 'than', 'also', 'too', 'very', 'more', 'most', 'any',
    'some', 'all', 'about', 'into', 'over', 'under', 'out', 'up', 'down',
    'if', 'because', 'while', 'when', 'where', 'why', 'how', 'there', 'here',
  ]),
  fr: new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', "d'", 'au', 'aux',
    'et', 'ou', 'mais', 'donc', 'or', 'car', 'ni', 'que', 'qui', 'quoi',
    'dont', 'où', 'ce', 'ça', 'cela', 'ces', 'cet', 'cette', 'mon', 'ma',
    'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'nos', 'notre', 'votre',
    'leurs', 'leur', 'il', 'elle', 'ils', 'elles', 'on', 'nous', 'vous',
    'je', "j'", 'tu', 'me', 'te', 'se', "s'", "n'", 'pas', 'plus', 'moins',
    'est', 'sont', 'était', 'sera', 'a', 'ai', 'as', 'ont', 'avons', 'avez',
    'avait', 'fait', 'faire', 'être', 'avoir', 'dans', 'par', 'pour',
    'sur', 'sous', 'avec', 'sans', 'vers', 'chez', 'si', 'quand', 'comme',
    'très', 'trop', 'tout', 'tous', 'toute', 'toutes',
  ]),
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
    'al', 'a', 'y', 'o', 'pero', 'que', 'qué', 'quien', 'quién', 'cual',
    'cuál', 'es', 'son', 'era', 'eran', 'fue', 'ser', 'estar', 'está',
    'están', 'estaba', 'he', 'ha', 'has', 'han', 'habia', 'había', 'mi',
    'tu', 'su', 'sus', 'mis', 'tus', 'nos', 'vos', 'yo', 'me', 'te', 'se',
    'lo', 'le', 'les', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre',
    'hasta', 'desde', 'si', 'no', 'sí', 'como', 'más', 'menos', 'muy',
    'también', 'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'aquel',
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'eines', 'und', 'oder', 'aber', 'doch', 'denn', 'ist', 'sind',
    'war', 'waren', 'sein', 'habe', 'hat', 'hatte', 'hatten', 'haben', 'wird',
    'werden', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein',
    'sein', 'unser', 'euer', 'mich', 'dich', 'sich', 'mir', 'dir', 'ihm', 'ihn',
    'in', 'auf', 'an', 'bei', 'von', 'mit', 'aus', 'nach', 'über', 'unter',
    'vor', 'zwischen', 'durch', 'für', 'gegen', 'ohne', 'um', 'zu', 'als',
    'wie', 'wenn', 'weil', 'dass', 'nicht', 'kein', 'keine', 'sehr', 'auch',
    'nur', 'noch', 'schon', 'immer', 'so', 'dann', 'also',
  ]),
  it: new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', "un'",
    'di', 'del', 'della', 'dei', 'delle', 'a', 'al', 'alla', 'ai',
    'alle', 'da', 'dal', 'dalla', 'in', 'nel', 'nella', 'su', 'sul',
    'sulla', 'per', 'con', 'senza', 'tra', 'fra', 'e', 'o', 'ma', 'se',
    'che', 'chi', 'cosa', 'è', 'sono', 'era', 'erano', 'essere', 'ho',
    'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'avere', 'io', 'tu', 'lui',
    'lei', 'noi', 'voi', 'loro', 'mi', 'ti', 'si', 'ci', 'vi', 'mio',
    'tuo', 'suo', 'nostro', 'vostro', 'non', 'più', 'molto', 'tutto',
    'anche', 'come', 'quando',
  ]),
  pt: new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da',
    'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com',
    'sem', 'sobre', 'entre', 'e', 'ou', 'mas', 'que', 'quem', 'qual',
    'é', 'são', 'era', 'foi', 'ser', 'estar', 'está', 'estão', 'tenho',
    'tem', 'tinha', 'ter', 'haver', 'eu', 'tu', 'ele', 'ela', 'nós',
    'vós', 'eles', 'elas', 'meu', 'seu', 'nosso', 'me', 'te', 'se',
    'não', 'muito', 'mais', 'também', 'como', 'quando',
  ]),
};

function stopwordsFor(language: string): Set<string> {
  const code = language.slice(0, 2).toLowerCase();
  return STOPWORDS[code] ?? STOPWORDS.en;
}

// -------- Emotion markers (multi-lang regex hits) --------
// Detects phrase families (not just keywords). Intentionally generous —
// false positives are fine because the user curates what actually matters.

interface EmotionPattern {
  category: EmotionCategoryV2;
  lang: string;
  phrase: string;
  intensity?: number; // 1-3, higher = stronger signal (default 1)
}

const EMOTION_PATTERNS: EmotionPattern[] = [
  // --- EN: FEAR ---
  { category: 'fear',         lang: 'en', phrase: 'scared', intensity: 2 },
  { category: 'fear',         lang: 'en', phrase: 'afraid', intensity: 2 },
  { category: 'fear',         lang: 'en', phrase: 'worried' },
  { category: 'fear',         lang: 'en', phrase: 'anxious', intensity: 2 },
  { category: 'fear',         lang: 'en', phrase: 'panic', intensity: 3 },
  { category: 'fear',         lang: 'en', phrase: "i'm scared", intensity: 3 },
  { category: 'fear',         lang: 'en', phrase: 'terrified', intensity: 3 },
  { category: 'fear',         lang: 'en', phrase: 'freaking out', intensity: 3 },
  { category: 'fear',         lang: 'en', phrase: "can't stop thinking about", intensity: 2 },
  { category: 'fear',         lang: 'en', phrase: 'what if', intensity: 1 },
  // --- EN: FRUSTRATION ---
  { category: 'frustration',  lang: 'en', phrase: 'fed up', intensity: 2 },
  { category: 'frustration',  lang: 'en', phrase: 'sick of', intensity: 2 },
  { category: 'frustration',  lang: 'en', phrase: 'tired of', intensity: 2 },
  { category: 'frustration',  lang: 'en', phrase: 'hate', intensity: 2 },
  { category: 'frustration',  lang: 'en', phrase: 'annoying' },
  { category: 'frustration',  lang: 'en', phrase: "can't stand", intensity: 2 },
  { category: 'frustration',  lang: 'en', phrase: 'ridiculous' },
  { category: 'frustration',  lang: 'en', phrase: 'so frustrating', intensity: 2 },
  { category: 'frustration',  lang: 'en', phrase: 'makes me angry', intensity: 2 },
  // --- EN: HOPE ---
  { category: 'hope',         lang: 'en', phrase: 'hope' },
  { category: 'hope',         lang: 'en', phrase: 'wish' },
  { category: 'hope',         lang: 'en', phrase: 'finally', intensity: 2 },
  { category: 'hope',         lang: 'en', phrase: 'dream of' },
  { category: 'hope',         lang: 'en', phrase: 'looking forward', intensity: 2 },
  { category: 'hope',         lang: 'en', phrase: 'one day' },
  { category: 'hope',         lang: 'en', phrase: 'maybe this time' },
  // --- EN: DESPERATION ---
  { category: 'desperation',  lang: 'en', phrase: 'desperate', intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: 'nothing works', intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: 'tried everything', intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: "at my wit's end", intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: "don't know what to do", intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: "i give up", intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: 'nothing left to try', intensity: 3 },
  { category: 'desperation',  lang: 'en', phrase: 'at a loss', intensity: 2 },
  { category: 'desperation',  lang: 'en', phrase: 'out of options', intensity: 3 },
  // --- EN: SHAME ---
  { category: 'shame',        lang: 'en', phrase: 'embarrassed', intensity: 2 },
  { category: 'shame',        lang: 'en', phrase: 'ashamed', intensity: 3 },
  { category: 'shame',        lang: 'en', phrase: "don't want anyone to know", intensity: 3 },
  { category: 'shame',        lang: 'en', phrase: 'humiliating', intensity: 3 },
  { category: 'shame',        lang: 'en', phrase: "can't tell anyone", intensity: 3 },
  { category: 'shame',        lang: 'en', phrase: 'hide it from', intensity: 2 },
  { category: 'shame',        lang: 'en', phrase: 'secretly', intensity: 2 },
  // --- EN: EXHAUSTION ---
  { category: 'exhaustion',   lang: 'en', phrase: 'exhausted', intensity: 2 },
  { category: 'exhaustion',   lang: 'en', phrase: 'worn out', intensity: 2 },
  { category: 'exhaustion',   lang: 'en', phrase: "can't keep up", intensity: 2 },
  { category: 'exhaustion',   lang: 'en', phrase: 'no energy', intensity: 2 },
  { category: 'exhaustion',   lang: 'en', phrase: 'burned out', intensity: 3 },
  { category: 'exhaustion',   lang: 'en', phrase: 'running on empty', intensity: 3 },
  { category: 'exhaustion',   lang: 'en', phrase: 'zombie', intensity: 2 },
  // --- EN: URGENCY ---
  { category: 'urgency',      lang: 'en', phrase: 'right now', intensity: 2 },
  { category: 'urgency',      lang: 'en', phrase: 'asap', intensity: 2 },
  { category: 'urgency',      lang: 'en', phrase: 'as soon as possible', intensity: 2 },
  { category: 'urgency',      lang: 'en', phrase: "can't wait", intensity: 2 },
  { category: 'urgency',      lang: 'en', phrase: 'need this now', intensity: 3 },
  // --- EN: SKEPTICISM ---
  { category: 'skepticism',   lang: 'en', phrase: 'scam', intensity: 3 },
  { category: 'skepticism',   lang: 'en', phrase: 'too good to be true', intensity: 2 },
  { category: 'skepticism',   lang: 'en', phrase: "doesn't work", intensity: 2 },
  { category: 'skepticism',   lang: 'en', phrase: 'waste of money', intensity: 3 },
  { category: 'skepticism',   lang: 'en', phrase: 'snake oil', intensity: 3 },
  { category: 'skepticism',   lang: 'en', phrase: 'rip off', intensity: 3 },
  { category: 'skepticism',   lang: 'en', phrase: "don't believe", intensity: 2 },
  // --- EN: NEW CATEGORIES ---
  { category: 'desire',       lang: 'en', phrase: 'i want', intensity: 2 },
  { category: 'desire',       lang: 'en', phrase: 'i need', intensity: 2 },
  { category: 'desire',       lang: 'en', phrase: 'if only', intensity: 2 },
  { category: 'desire',       lang: 'en', phrase: 'would do anything', intensity: 3 },
  { category: 'desire',       lang: 'en', phrase: 'dream of', intensity: 2 },
  { category: 'desire',       lang: 'en', phrase: "i'd pay anything", intensity: 3 },
  { category: 'guilt',        lang: 'en', phrase: 'feel guilty', intensity: 2 },
  { category: 'guilt',        lang: 'en', phrase: 'my fault', intensity: 2 },
  { category: 'guilt',        lang: 'en', phrase: 'should have', intensity: 1 },
  { category: 'guilt',        lang: 'en', phrase: 'blame myself', intensity: 3 },
  { category: 'guilt',        lang: 'en', phrase: 'letting everyone down', intensity: 3 },
  { category: 'isolation',    lang: 'en', phrase: 'alone in this', intensity: 3 },
  { category: 'isolation',    lang: 'en', phrase: 'no one understands', intensity: 3 },
  { category: 'isolation',    lang: 'en', phrase: 'feel so alone', intensity: 3 },
  { category: 'isolation',    lang: 'en', phrase: "can't talk to anyone", intensity: 3 },
  { category: 'isolation',    lang: 'en', phrase: 'nobody gets it', intensity: 2 },
  { category: 'anger',        lang: 'en', phrase: 'furious', intensity: 3 },
  { category: 'anger',        lang: 'en', phrase: 'pissed', intensity: 3 },
  { category: 'anger',        lang: 'en', phrase: 'makes my blood boil', intensity: 3 },
  { category: 'anger',        lang: 'en', phrase: 'unacceptable', intensity: 2 },
  { category: 'anger',        lang: 'en', phrase: 'so angry', intensity: 3 },
  { category: 'envy',         lang: 'en', phrase: 'jealous', intensity: 2 },
  { category: 'envy',         lang: 'en', phrase: 'why can everyone else', intensity: 2 },
  { category: 'envy',         lang: 'en', phrase: "it's not fair", intensity: 2 },
  { category: 'envy',         lang: 'en', phrase: 'lucky them', intensity: 1 },
  { category: 'pride',        lang: 'en', phrase: 'proud of', intensity: 2 },
  { category: 'pride',        lang: 'en', phrase: 'proved them wrong', intensity: 3 },
  { category: 'pride',        lang: 'en', phrase: 'i did it', intensity: 2 },
  { category: 'helplessness', lang: 'en', phrase: 'helpless', intensity: 3 },
  { category: 'helplessness', lang: 'en', phrase: 'powerless', intensity: 3 },
  { category: 'helplessness', lang: 'en', phrase: "can't control", intensity: 2 },
  { category: 'helplessness', lang: 'en', phrase: 'stuck', intensity: 2 },
  { category: 'helplessness', lang: 'en', phrase: 'trapped', intensity: 3 },
  { category: 'helplessness', lang: 'en', phrase: "there's nothing i can do", intensity: 3 },

  // --- FR: ORIGINAL + NEW ---
  { category: 'fear',         lang: 'fr', phrase: 'peur', intensity: 2 },
  { category: 'fear',         lang: 'fr', phrase: 'angoissé', intensity: 2 },
  { category: 'fear',         lang: 'fr', phrase: 'inquiet' },
  { category: 'fear',         lang: 'fr', phrase: 'terrorisé', intensity: 3 },
  { category: 'fear',         lang: 'fr', phrase: 'panique', intensity: 3 },
  { category: 'frustration',  lang: 'fr', phrase: 'marre', intensity: 2 },
  { category: 'frustration',  lang: 'fr', phrase: 'en ai marre', intensity: 2 },
  { category: 'frustration',  lang: 'fr', phrase: 'ras le bol', intensity: 3 },
  { category: 'frustration',  lang: 'fr', phrase: 'déteste', intensity: 2 },
  { category: 'frustration',  lang: 'fr', phrase: 'insupportable', intensity: 2 },
  { category: 'hope',         lang: 'fr', phrase: 'espère' },
  { category: 'hope',         lang: 'fr', phrase: 'enfin', intensity: 2 },
  { category: 'hope',         lang: 'fr', phrase: 'rêve de' },
  { category: 'hope',         lang: 'fr', phrase: 'un jour' },
  { category: 'desperation',  lang: 'fr', phrase: 'désespéré', intensity: 3 },
  { category: 'desperation',  lang: 'fr', phrase: 'rien ne marche', intensity: 3 },
  { category: 'desperation',  lang: 'fr', phrase: 'tout essayé', intensity: 3 },
  { category: 'desperation',  lang: 'fr', phrase: 'ne sais plus quoi faire', intensity: 3 },
  { category: 'desperation',  lang: 'fr', phrase: "j'abandonne", intensity: 3 },
  { category: 'shame',        lang: 'fr', phrase: 'honte', intensity: 2 },
  { category: 'shame',        lang: 'fr', phrase: 'gêné', intensity: 2 },
  { category: 'shame',        lang: 'fr', phrase: 'humiliant', intensity: 3 },
  { category: 'shame',        lang: 'fr', phrase: 'en secret', intensity: 2 },
  { category: 'exhaustion',   lang: 'fr', phrase: 'épuisé', intensity: 2 },
  { category: 'exhaustion',   lang: 'fr', phrase: 'crevé', intensity: 2 },
  { category: 'exhaustion',   lang: 'fr', phrase: 'à bout', intensity: 3 },
  { category: 'exhaustion',   lang: 'fr', phrase: 'vidé', intensity: 2 },
  { category: 'urgency',      lang: 'fr', phrase: 'tout de suite', intensity: 2 },
  { category: 'urgency',      lang: 'fr', phrase: 'maintenant', intensity: 2 },
  { category: 'urgency',      lang: 'fr', phrase: 'urgent', intensity: 2 },
  { category: 'skepticism',   lang: 'fr', phrase: 'arnaque', intensity: 3 },
  { category: 'skepticism',   lang: 'fr', phrase: 'ça ne marche pas', intensity: 2 },
  { category: 'skepticism',   lang: 'fr', phrase: 'gaspillage', intensity: 2 },
  { category: 'desire',       lang: 'fr', phrase: 'je veux', intensity: 2 },
  { category: 'desire',       lang: 'fr', phrase: "j'ai besoin", intensity: 2 },
  { category: 'desire',       lang: 'fr', phrase: 'si seulement', intensity: 2 },
  { category: 'desire',       lang: 'fr', phrase: 'je donnerais tout', intensity: 3 },
  { category: 'guilt',        lang: 'fr', phrase: 'culpabilité', intensity: 2 },
  { category: 'guilt',        lang: 'fr', phrase: 'ma faute', intensity: 2 },
  { category: 'guilt',        lang: 'fr', phrase: "j'aurais dû", intensity: 1 },
  { category: 'isolation',    lang: 'fr', phrase: 'seul', intensity: 2 },
  { category: 'isolation',    lang: 'fr', phrase: 'personne ne comprend', intensity: 3 },
  { category: 'isolation',    lang: 'fr', phrase: 'tout seul', intensity: 3 },
  { category: 'anger',        lang: 'fr', phrase: 'furieux', intensity: 3 },
  { category: 'anger',        lang: 'fr', phrase: 'en colère', intensity: 2 },
  { category: 'anger',        lang: 'fr', phrase: 'révolté', intensity: 3 },
  { category: 'helplessness', lang: 'fr', phrase: 'impuissant', intensity: 3 },
  { category: 'helplessness', lang: 'fr', phrase: 'coincé', intensity: 2 },
  { category: 'helplessness', lang: 'fr', phrase: 'piégé', intensity: 3 },
  { category: 'helplessness', lang: 'fr', phrase: 'bloqué', intensity: 2 },

  // --- ES: ORIGINAL + NEW ---
  { category: 'fear',         lang: 'es', phrase: 'miedo', intensity: 2 },
  { category: 'fear',         lang: 'es', phrase: 'ansiedad', intensity: 2 },
  { category: 'frustration',  lang: 'es', phrase: 'harto', intensity: 2 },
  { category: 'frustration',  lang: 'es', phrase: 'estoy harto', intensity: 2 },
  { category: 'frustration',  lang: 'es', phrase: 'odio', intensity: 2 },
  { category: 'hope',         lang: 'es', phrase: 'espero' },
  { category: 'hope',         lang: 'es', phrase: 'por fin', intensity: 2 },
  { category: 'desperation',  lang: 'es', phrase: 'desesperado', intensity: 3 },
  { category: 'desperation',  lang: 'es', phrase: 'nada funciona', intensity: 3 },
  { category: 'desperation',  lang: 'es', phrase: 'he probado todo', intensity: 3 },
  { category: 'shame',        lang: 'es', phrase: 'vergüenza', intensity: 2 },
  { category: 'exhaustion',   lang: 'es', phrase: 'agotado', intensity: 2 },
  { category: 'exhaustion',   lang: 'es', phrase: 'cansado', intensity: 2 },
  { category: 'urgency',      lang: 'es', phrase: 'ahora mismo', intensity: 2 },
  { category: 'skepticism',   lang: 'es', phrase: 'estafa', intensity: 3 },
  { category: 'skepticism',   lang: 'es', phrase: 'no funciona', intensity: 2 },
  { category: 'desire',       lang: 'es', phrase: 'necesito', intensity: 2 },
  { category: 'desire',       lang: 'es', phrase: 'quiero', intensity: 2 },
  { category: 'guilt',        lang: 'es', phrase: 'culpa', intensity: 2 },
  { category: 'isolation',    lang: 'es', phrase: 'nadie entiende', intensity: 3 },
  { category: 'isolation',    lang: 'es', phrase: 'solo en esto', intensity: 3 },
  { category: 'anger',        lang: 'es', phrase: 'furioso', intensity: 3 },
  { category: 'helplessness', lang: 'es', phrase: 'atrapado', intensity: 3 },
  { category: 'helplessness', lang: 'es', phrase: 'sin salida', intensity: 3 },

  // --- DE: ORIGINAL + NEW ---
  { category: 'fear',         lang: 'de', phrase: 'angst', intensity: 2 },
  { category: 'fear',         lang: 'de', phrase: 'panik', intensity: 3 },
  { category: 'frustration',  lang: 'de', phrase: 'keine lust', intensity: 2 },
  { category: 'frustration',  lang: 'de', phrase: 'nervt', intensity: 2 },
  { category: 'hope',         lang: 'de', phrase: 'hoffnung' },
  { category: 'hope',         lang: 'de', phrase: 'endlich', intensity: 2 },
  { category: 'desperation',  lang: 'de', phrase: 'verzweifelt', intensity: 3 },
  { category: 'desperation',  lang: 'de', phrase: 'nichts hilft', intensity: 3 },
  { category: 'desperation',  lang: 'de', phrase: 'alles probiert', intensity: 3 },
  { category: 'exhaustion',   lang: 'de', phrase: 'erschöpft', intensity: 2 },
  { category: 'exhaustion',   lang: 'de', phrase: 'müde', intensity: 1 },
  { category: 'exhaustion',   lang: 'de', phrase: 'ausgebrannt', intensity: 3 },
  { category: 'skepticism',   lang: 'de', phrase: 'betrug', intensity: 3 },
  { category: 'skepticism',   lang: 'de', phrase: 'funktioniert nicht', intensity: 2 },
  { category: 'desire',       lang: 'de', phrase: 'ich brauche', intensity: 2 },
  { category: 'guilt',        lang: 'de', phrase: 'schuld', intensity: 2 },
  { category: 'isolation',    lang: 'de', phrase: 'niemand versteht', intensity: 3 },
  { category: 'anger',        lang: 'de', phrase: 'wütend', intensity: 3 },
  { category: 'helplessness', lang: 'de', phrase: 'hilflos', intensity: 3 },
  { category: 'helplessness', lang: 'de', phrase: 'gefangen', intensity: 3 },
];

// -------- Tokenization / normalization --------

function stripMarkdown(text: string): string {
  return text
    // fenced code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // inline code
    .replace(/`[^`]*`/g, ' ')
    // links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // bare urls
    .replace(/https?:\/\/\S+/g, ' ')
    // images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    // headings / emphasis markers
    .replace(/[#*_~>]+/g, ' ')
    // HTML tags
    .replace(/<[^>]+>/g, ' ');
}

function normalizeForNgrams(text: string): string {
  return stripMarkdown(text)
    .toLowerCase()
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// -------- Boilerplate stripping (UI chrome / nav / legal / scraper artifacts) --------
// Scraped HTML often carries site nav, footers, review counts, cookie banners.
// Left in, these dominate n-gram tables ("verified purchase", "sign up", "related
// questions") and drown out real voice-of-customer. We filter them from the
// n-gram path only — never from the verbatim corpus, so picks stay untouched.

const BOILERPLATE_LINE_PATTERNS: RegExp[] = [
  // Quora chrome
  /^\s*(upvote|downvote|comment|follow|share|related questions?|view \d+ comments?)\s*$/i,
  /quora user|view \d+ upvotes?|answer requested by|\d+ answers?\s*·/i,
  // Reddit chrome
  /^\s*(posted by|\d+ comments?|share|save|hide|report|give award|r\/[a-z0-9_]+)\s*$/i,
  /level \d+ ·|comment deleted by user|continue this thread|view (?:all|\d+) (?:more )?comments?/i,
  // Amazon chrome
  /verified purchase|reviewed in the .+ on |helpful\s*\|\s*report abuse|\d+\s*(?:out of|\/)\s*5 stars/i,
  /one person found this helpful|\d+ people found this helpful|customers who (?:bought|viewed) this/i,
  /add to (?:cart|basket|wish\s*list)|see all buying options|frequently bought together/i,
  // YouTube chrome
  /\d+(?:\.\d+)?[km]?\s*(?:subscribers?|views?|likes?)/i,
  /subscribe to .+ channel|comments? turned off|show more|show less/i,
  // TikTok / IG chrome
  /#fyp|#foryou|#foryoupage|link in bio|tap to (?:follow|like)/i,
  // Generic / legal / cookies / SEO
  /cookie (?:policy|banner|notice)|we use cookies|accept (?:all )?cookies/i,
  /privacy policy|terms of (?:service|use)|all rights reserved|©\s*\d{4}|\bgdpr\b/i,
  /sign (?:in|up)|log (?:in|out)|create (?:an )?account|forgot (?:your )?password/i,
  /loading\.\.\.|please wait|click here|read more|show (?:more|less)|load more/i,
  /back to top|skip to (?:main )?content|menu\s*·|breadcrumbs?/i,
  // Forum chrome
  /joined: \w+ \d{4}|posts?: \d+|last edited:|quote:?\s*originally posted by/i,
  /thanks:|rep:|location:|\bPM me\b|sent you a PM/i,
];

// Junk n-grams we never want to see in the top tables (post-filter safety net).
const JUNK_GRAM_REGEX = /\b(?:cookie|privacy|sign up|log in|click here|read more|show more|show less|load more|related questions?|verified purchase|helpful report|all rights reserved|terms service|subscribe channel|link bio|skip content|continue thread)\b/i;

function stripBoilerplate(text: string): string {
  // Split into lines + sentences, drop anything that matches a boilerplate pattern.
  const chunks = text.split(/(?:\r?\n|(?<=[.!?])\s+)/);
  const kept: string[] = [];
  for (const chunk of chunks) {
    const t = chunk.trim();
    if (!t) continue;
    if (BOILERPLATE_LINE_PATTERNS.some((re) => re.test(t))) continue;
    kept.push(t);
  }
  return kept.join(' ');
}

function tokenize(text: string): string[] {
  // Split on non-letter chars but KEEP apostrophes attached
  // (so "can't" stays as one token instead of ["can", "t"])
  return text
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function isJunkToken(tok: string, stopwords: Set<string>): boolean {
  if (tok.length < 2) return true;
  if (/^\d+$/.test(tok)) return true;
  if (stopwords.has(tok)) return true;
  return false;
}

// -------- N-gram extraction --------

interface GramAccumulator {
  count: number;
  sources: Set<SourceType>;
}

function buildNgrams(
  tokens: string[],
  n: number,
  stopwords: Set<string>,
): string[] {
  const grams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const slice = tokens.slice(i, i + n);
    // Drop if all tokens are stopwords (keeps "i can't sleep", drops "the and of")
    const allStop = slice.every((t) => stopwords.has(t));
    if (allStop) continue;
    // Drop if first OR last token is junk (usually means we're in the middle
    // of sentence fragments that aren't meaningful)
    if (isJunkToken(slice[0], stopwords)) continue;
    if (isJunkToken(slice[slice.length - 1], stopwords)) continue;
    grams.push(slice.join(' '));
  }
  return grams;
}

function topGrams(acc: Map<string, GramAccumulator>, limit: number): NgramStat[] {
  return Array.from(acc.entries())
    .map(([gram, { count, sources }]): NgramStat => ({
      gram,
      count,
      sources: sources.size,
    }))
    .filter((g) => g.count >= 2) // ignore singletons — noise
    .sort((a, b) => {
      // Primary: frequency. Secondary: source diversity.
      if (b.count !== a.count) return b.count - a.count;
      return b.sources - a.sources;
    })
    .slice(0, limit);
}

// -------- Main builder --------

export interface BuildRawSignalParams {
  fetchData: Partial<Record<SourceType, RawSourceData>>;
  language: string;
}

export function buildRawSignal(params: BuildRawSignalParams): RawSignal {
  const { fetchData, language } = params;
  const stopwords = stopwordsFor(language);
  const langCode = language.slice(0, 2).toLowerCase();

  // 1) Flatten ALL scraped text into RawSignalItems (never filtered)
  const items: RawSignalItem[] = [];
  let totalCharCount = 0;

  for (const [sourceKey, raw] of Object.entries(fetchData)) {
    if (!raw) continue;
    const source = sourceKey as SourceType;
    for (const item of raw.items) {
      // Each scraped item becomes one RawSignalItem. Comments become
      // separate items so they can be picked individually.
      const mainText = item.content ?? '';
      if (mainText.trim().length > 0) {
        items.push({
          text: mainText.slice(0, 4000), // hard cap per item to avoid mega-blobs
          source_type: source,
          source_url: item.url,
          title: item.title,
          scraped_at: new Date().toISOString(),
          char_count: mainText.length,
        });
        totalCharCount += mainText.length;
      }

      if (item.comments && item.comments.length > 0) {
        for (const comment of item.comments) {
          if (typeof comment !== 'string' || comment.trim().length < 20) continue;
          items.push({
            text: comment.slice(0, 2000),
            source_type: source,
            source_url: item.url,
            title: item.title,
            scraped_at: new Date().toISOString(),
            char_count: comment.length,
          });
          totalCharCount += comment.length;
        }
      }
    }
  }

  // 2) Build n-gram frequency tables across all items, tracking source diversity
  const unigrams = new Map<string, GramAccumulator>();
  const bigrams = new Map<string, GramAccumulator>();
  const trigrams = new Map<string, GramAccumulator>();
  const fourgrams = new Map<string, GramAccumulator>();
  const fivegrams = new Map<string, GramAccumulator>();

  function bump(
    map: Map<string, GramAccumulator>,
    gram: string,
    source: SourceType,
  ) {
    const existing = map.get(gram);
    if (existing) {
      existing.count++;
      existing.sources.add(source);
    } else {
      map.set(gram, { count: 1, sources: new Set([source]) });
    }
  }

  for (const item of items) {
    // For n-gram extraction we strip UI boilerplate (nav, cookie banners,
    // review chrome) so the tables reflect real voice-of-customer. Verbatim
    // preservation in `items` stays untouched.
    const normalized = stripBoilerplate(normalizeForNgrams(item.text));
    const tokens = tokenize(normalized);

    // 1-grams: filter out stopwords aggressively (they dominate otherwise)
    for (const tok of tokens) {
      if (isJunkToken(tok, stopwords)) continue;
      bump(unigrams, tok, item.source_type);
    }

    for (const g of buildNgrams(tokens, 2, stopwords)) bump(bigrams, g, item.source_type);
    for (const g of buildNgrams(tokens, 3, stopwords)) bump(trigrams, g, item.source_type);
    for (const g of buildNgrams(tokens, 4, stopwords)) bump(fourgrams, g, item.source_type);
    for (const g of buildNgrams(tokens, 5, stopwords)) bump(fivegrams, g, item.source_type);
  }

  // Post-filter: drop any n-grams that survived and match the junk regex.
  // Cheaper than a per-token filter during ingestion and catches combinations
  // we didn't anticipate.
  for (const map of [unigrams, bigrams, trigrams, fourgrams, fivegrams]) {
    for (const gram of map.keys()) {
      if (JUNK_GRAM_REGEX.test(gram)) map.delete(gram);
    }
  }

  // 3) Emotion markers — regex each pattern against the full normalized corpus
  //    but also track which sources fired. Only run patterns for the doc's language
  //    plus English (as a universal fallback since comments often code-switch).
  //    NEW: negation-aware detection — skip matches preceded by "not", "isn't", "no", etc.
  const langsToTry = Array.from(new Set([langCode, 'en']));
  const emotionHits = new Map<string, EmotionMarkerHit>();

  for (const pattern of EMOTION_PATTERNS) {
    if (!langsToTry.includes(pattern.lang)) continue;
    const key = `${pattern.category}::${pattern.phrase}`;
    // Negation-aware regex: skip if preceded by common negation words
    const negationPrefix = `(?<!\\b(?:not|isn't|isn\\'t|wasn't|aren't|don't|doesn't|didn't|never|no|isn|ain't|wasn|aren|doesn|didn|wouldn't|without|nor)\\s)`;
    const regex = new RegExp(`${negationPrefix}\\b${escapeRegex(pattern.phrase)}\\b`, 'gi');

    let totalCount = 0;
    const sources = new Set<SourceType>();

    for (const item of items) {
      const normalized = normalizeForNgrams(item.text);
      const matches = normalized.match(regex);
      if (matches && matches.length > 0) {
        totalCount += matches.length;
        sources.add(item.source_type);
      }
    }

    if (totalCount > 0) {
      emotionHits.set(key, {
        category: pattern.category,
        phrase: pattern.phrase,
        lang: pattern.lang,
        count: totalCount,
        sources: sources.size,
      });
    }
  }

  // Sort emotion markers: by intensity weight × count, then category
  const emotion_markers = Array.from(emotionHits.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.count - a.count;
  });

  // 4) Top-phrases = pick the best from 4-grams and 5-grams combined
  const topPhrasesCombined = [
    ...topGrams(fourgrams, 50),
    ...topGrams(fivegrams, 30),
  ]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.sources - a.sources;
    })
    .slice(0, 30);

  // 5) Identity markers — detect "I am", "I'm not", "I feel like", "I used to be" patterns
  const identity_markers = extractIdentityMarkers(items, langsToTry);

  // 6) Buying signals — detect comparison, price, purchase intent patterns
  const buying_signals = extractBuyingSignals(items, langsToTry);

  // 7) Golden sentences — full sentences with high emotional charge
  const golden_sentences = extractGoldenSentences(items, emotionHits, langsToTry);

  // 8) Scored phrases — n-grams ranked by marketing value
  const scored_phrases = scorePhrasesForMarketing(
    unigrams, bigrams, trigrams, fourgrams, fivegrams,
    emotionHits, identity_markers, buying_signals,
  );

  // Collect per-source diagnostic errors (from fetchers that returned 0 items).
  const source_errors: Record<string, string> = {};
  for (const [sourceKey, raw] of Object.entries(fetchData)) {
    if (raw?.error) source_errors[sourceKey] = raw.error;
  }

  return {
    generated_at: new Date().toISOString(),
    items,
    total_char_count: totalCharCount,
    total_items: items.length,
    source_breakdown: buildSourceBreakdown(items),
    source_errors: Object.keys(source_errors).length > 0 ? source_errors : undefined,
    top_unigrams: topGrams(unigrams, 30),
    top_bigrams: topGrams(bigrams, 50),
    top_trigrams: topGrams(trigrams, 50),
    top_phrases: topPhrasesCombined,
    emotion_markers,
    scored_phrases,
    identity_markers,
    buying_signals,
    golden_sentences,
    picks: { phrases: [], verbatims: [], emotion_markers: [] },
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSourceBreakdown(items: RawSignalItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    out[item.source_type] = (out[item.source_type] ?? 0) + 1;
  }
  return out;
}

// -------- Identity marker extraction --------
// Detects "I am / I'm / I feel like / I used to be / I'm not" patterns
// and multilingual equivalents. These are ad copy GOLD.

interface IdentityPattern {
  regex: RegExp;
  type: IdentityMarkerHit['type'];
  langs: string[];
}

const IDENTITY_PATTERNS: IdentityPattern[] = [
  // EN: self-identification
  { regex: /\b(i am|i'm|i consider myself|i've always been)\b[^.!?\n]{3,80}/gi, type: 'self_identify', langs: ['en'] },
  // EN: anti-identification
  { regex: /\b(i'm not|i am not|i refuse to be|i'm not the kind of|i don't want to be)\b[^.!?\n]{3,80}/gi, type: 'anti_identify', langs: ['en'] },
  // EN: aspiration
  { regex: /\b(i want to be|i wish i was|i wish i were|i dream of being|one day i'll be|i want to become)\b[^.!?\n]{3,80}/gi, type: 'aspiration', langs: ['en'] },
  // EN: tribal
  { regex: /\b(people like me|we all|as a (?:mom|dad|parent|nurse|teacher|student|woman|man|person|professional))\b[^.!?\n]{3,80}/gi, type: 'tribal', langs: ['en'] },
  // FR: self-identification
  { regex: /\b(je suis|j'ai toujours été|je me considère)\b[^.!?\n]{3,80}/gi, type: 'self_identify', langs: ['fr'] },
  // FR: anti-identification
  { regex: /\b(je ne suis pas|je refuse d'être|je suis pas le genre|je veux pas être)\b[^.!?\n]{3,80}/gi, type: 'anti_identify', langs: ['fr'] },
  // FR: aspiration
  { regex: /\b(je veux devenir|je rêve d'être|j'aimerais être|un jour je serai)\b[^.!?\n]{3,80}/gi, type: 'aspiration', langs: ['fr'] },
  // FR: tribal
  { regex: /\b(les gens comme moi|on est tous|en tant que (?:mère|père|parent|femme|homme))\b[^.!?\n]{3,80}/gi, type: 'tribal', langs: ['fr'] },
  // ES: self-identification
  { regex: /\b(yo soy|siempre he sido|me considero)\b[^.!?\n]{3,80}/gi, type: 'self_identify', langs: ['es'] },
  // ES: anti-identification
  { regex: /\b(no soy|me niego a ser|no quiero ser)\b[^.!?\n]{3,80}/gi, type: 'anti_identify', langs: ['es'] },
];

function extractIdentityMarkers(items: RawSignalItem[], langs: string[]): IdentityMarkerHit[] {
  const hits = new Map<string, IdentityMarkerHit>();

  for (const pattern of IDENTITY_PATTERNS) {
    if (!pattern.langs.some(l => langs.includes(l))) continue;

    for (const item of items) {
      const text = normalizeForNgrams(item.text);
      const matches = text.match(pattern.regex);
      if (!matches) continue;

      for (const match of matches) {
        const cleaned = match.trim().slice(0, 120);
        const key = `${pattern.type}::${cleaned.slice(0, 40)}`;
        const existing = hits.get(key);
        if (existing) {
          existing.count++;
        } else {
          hits.set(key, {
            pattern: cleaned,
            type: pattern.type,
            source_type: item.source_type,
            count: 1,
          });
        }
      }
    }
  }

  return Array.from(hits.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

// -------- Buying signal extraction --------

interface BuyingPattern {
  regex: RegExp;
  type: BuyingSignalHit['type'];
  langs: string[];
}

const BUYING_PATTERNS: BuyingPattern[] = [
  // Comparison shopping
  { regex: /\b(\w+ (?:vs|versus|or|compared to|better than) \w+)\b/gi, type: 'comparison', langs: ['en'] },
  { regex: /\b(which (?:one|is better)|should i (?:get|buy|try|choose))\b[^.!?\n]{0,60}/gi, type: 'comparison', langs: ['en'] },
  { regex: /\b(lequel|quel est le meilleur|je devrais prendre|ou bien)\b[^.!?\n]{0,60}/gi, type: 'comparison', langs: ['fr'] },
  // Price sensitivity
  { regex: /\b(too expensive|overpriced|not worth|can't afford|waste of money|budget)\b/gi, type: 'price_sensitivity', langs: ['en'] },
  { regex: /\b(trop cher|hors de prix|pas les moyens|gaspillage|budget)\b/gi, type: 'price_sensitivity', langs: ['fr'] },
  { regex: /\b(worth (?:it|the (?:money|price|cost))|good value|cheap|affordable)\b/gi, type: 'price_sensitivity', langs: ['en'] },
  // Purchase intent
  { regex: /\b((?:thinking about|about to|going to|ready to|just) (?:buy|order|purchase|try|get))\b/gi, type: 'purchase_intent', langs: ['en'] },
  { regex: /\b(je vais (?:acheter|commander|prendre|essayer)|je pense (?:acheter|prendre))\b/gi, type: 'purchase_intent', langs: ['fr'] },
  { regex: /\b(just (?:bought|ordered|got|received)|i (?:bought|ordered|got))\b/gi, type: 'purchase_intent', langs: ['en'] },
  // Recommendation seeking
  { regex: /\b(has anyone (?:tried|used|heard)|can anyone recommend|what do you (?:recommend|suggest|think of))\b/gi, type: 'recommendation_seeking', langs: ['en'] },
  { regex: /\b(quelqu'un a (?:essayé|testé)|vous (?:recommandez|conseillez)|avis sur)\b/gi, type: 'recommendation_seeking', langs: ['fr'] },
  // Purchase urgency
  { regex: /\b(need (?:it|this) (?:now|asap|today|urgently)|where can i (?:buy|get|find))\b/gi, type: 'urgency', langs: ['en'] },
  { regex: /\b(où (?:acheter|trouver|commander)|besoin (?:maintenant|urgent|vite))\b/gi, type: 'urgency', langs: ['fr'] },
];

function extractBuyingSignals(items: RawSignalItem[], langs: string[]): BuyingSignalHit[] {
  const hits = new Map<string, BuyingSignalHit>();

  for (const pattern of BUYING_PATTERNS) {
    if (!pattern.langs.some(l => langs.includes(l))) continue;

    for (const item of items) {
      const text = normalizeForNgrams(item.text);
      const matches = text.match(pattern.regex);
      if (!matches) continue;

      for (const match of matches) {
        const cleaned = match.trim().slice(0, 80);
        const key = `${pattern.type}::${cleaned.slice(0, 30)}`;
        const existing = hits.get(key);
        if (existing) {
          existing.count++;
          existing.sources = Math.max(existing.sources, 1); // simplified
        } else {
          hits.set(key, {
            pattern: cleaned,
            type: pattern.type,
            count: 1,
            sources: 1,
          });
        }
      }
    }
  }

  return Array.from(hits.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

// -------- Golden sentence extraction --------
// Finds full sentences that contain high emotional charge.
// A "golden sentence" = sentence containing 2+ emotion markers OR 1 high-intensity marker.

function extractGoldenSentences(
  items: RawSignalItem[],
  emotionHits: Map<string, EmotionMarkerHit>,
  langs: string[],
): RawSignal['golden_sentences'] {
  // Build a fast lookup of all active emotion phrases
  const activePatterns = EMOTION_PATTERNS.filter(p => langs.includes(p.lang));
  const results: NonNullable<RawSignal['golden_sentences']> = [];

  for (const item of items) {
    // Split into sentences (rough but effective)
    const sentences = item.text
      .replace(/\n+/g, '. ')
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.length >= 20 && s.length <= 500);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const hitCategories: string[] = [];
      let intensitySum = 0;

      for (const pattern of activePatterns) {
        const regex = new RegExp(`\\b${escapeRegex(pattern.phrase)}\\b`, 'i');
        if (regex.test(lower)) {
          if (!hitCategories.includes(pattern.category)) {
            hitCategories.push(pattern.category);
          }
          intensitySum += pattern.intensity ?? 1;
        }
      }

      // Score: multi-emotion sentences and high-intensity ones are gold
      const score = Math.min(100, intensitySum * 15 + hitCategories.length * 20);

      // Threshold: score ≥ 30 (at least 2 mild hits or 1 strong hit)
      if (score >= 30) {
        results.push({
          sentence: sentence.trim().slice(0, 400),
          source_type: item.source_type,
          source_url: item.source_url,
          emotion_tags: hitCategories,
          score,
        });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // top 50 golden sentences
}

// -------- Smart phrase scoring --------
// Scores every n-gram by "marketing value" combining:
// - Frequency (raw count)
// - Source diversity (cross-platform validation)
// - Emotional charge (overlaps with emotion patterns)
// - Identity signal (overlaps with identity markers)
// - Buying signal (overlaps with buying patterns)

function scorePhrasesForMarketing(
  unigrams: Map<string, GramAccumulator>,
  bigrams: Map<string, GramAccumulator>,
  trigrams: Map<string, GramAccumulator>,
  fourgrams: Map<string, GramAccumulator>,
  fivegrams: Map<string, GramAccumulator>,
  emotionHits: Map<string, EmotionMarkerHit>,
  identityMarkers: IdentityMarkerHit[],
  buyingSignals: BuyingSignalHit[],
): ScoredPhrase[] {
  // Merge all n-grams (2+ grams are more useful for marketing)
  const allGrams = new Map<string, GramAccumulator>();
  for (const [k, v] of bigrams) if (v.count >= 2) allGrams.set(k, v);
  for (const [k, v] of trigrams) if (v.count >= 2) allGrams.set(k, v);
  for (const [k, v] of fourgrams) if (v.count >= 2) allGrams.set(k, v);
  for (const [k, v] of fivegrams) if (v.count >= 2) allGrams.set(k, v);

  // Build lookup sets for tagging
  const emotionPhrases = new Set(
    Array.from(emotionHits.values()).map(h => h.phrase.toLowerCase()),
  );
  const identityPhrases = new Set(
    identityMarkers.map(m => m.pattern.toLowerCase().slice(0, 30)),
  );
  const buyingPhrases = new Set(
    buyingSignals.map(b => b.pattern.toLowerCase().slice(0, 30)),
  );

  const results: ScoredPhrase[] = [];

  for (const [gram, acc] of allGrams) {
    const tags: string[] = [];
    let score = 0;

    // Base: frequency (log scale, max 30 pts)
    score += Math.min(30, Math.log2(acc.count + 1) * 8);

    // Source diversity bonus (max 25 pts)
    score += Math.min(25, acc.sources.size * 8);

    // Emotional charge: check if gram contains any emotion phrase
    let hasEmotion = false;
    for (const ep of emotionPhrases) {
      if (gram.includes(ep) || ep.includes(gram)) {
        hasEmotion = true;
        break;
      }
    }
    if (hasEmotion) {
      tags.push('high_emotion');
      score += 20;
    }

    // Identity signal
    let hasIdentity = false;
    for (const ip of identityPhrases) {
      if (gram.includes(ip.slice(0, 15)) || ip.includes(gram)) {
        hasIdentity = true;
        break;
      }
    }
    if (hasIdentity) {
      tags.push('identity');
      score += 15;
    }

    // Buying signal
    let hasBuying = false;
    for (const bp of buyingPhrases) {
      if (gram.includes(bp.slice(0, 15)) || bp.includes(gram)) {
        hasBuying = true;
        break;
      }
    }
    if (hasBuying) {
      tags.push('buying_signal');
      score += 15;
    }

    // Length bonus: longer phrases are more specific (max 10 pts)
    const wordCount = gram.split(' ').length;
    score += Math.min(10, wordCount * 2);

    score = Math.min(100, Math.round(score));

    if (score >= 20) {
      results.push({
        phrase: gram,
        score,
        count: acc.count,
        sources: acc.sources.size,
        tags,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
}

// -------- Pick helpers (used by UI to toggle golden nuggets) --------

export function togglePick(
  picks: RawSignal['picks'] | undefined,
  category: 'phrases' | 'verbatims' | 'emotion_markers',
  value: string,
): NonNullable<RawSignal['picks']> {
  const current: NonNullable<RawSignal['picks']> = picks ?? {
    phrases: [],
    verbatims: [],
    emotion_markers: [],
  };
  const existing = current[category];
  const next = existing.includes(value)
    ? existing.filter((v) => v !== value)
    : [...existing, value];
  return { ...current, [category]: next };
}

export function isPicked(
  picks: RawSignal['picks'] | undefined,
  category: 'phrases' | 'verbatims' | 'emotion_markers',
  value: string,
): boolean {
  if (!picks) return false;
  return picks[category].includes(value);
}
