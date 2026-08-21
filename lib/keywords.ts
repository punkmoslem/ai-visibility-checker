// Keyword extraction engine.
// Scans raw AI responses to find recurring descriptive phrases associated
// with the brand and competitors, then identifies keyword gaps to target.

export interface KeywordEntry {
  phrase: string;
  count: number;
  associatedWith: string[];
}

export interface KeywordAnalysis {
  brandKeywords: KeywordEntry[];
  competitorKeywords: KeywordEntry[];
  gaps: KeywordEntry[];
  targetKeywords: string[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must", "ought",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
  "us", "them", "my", "your", "his", "its", "our", "their", "this",
  "that", "these", "those", "what", "which", "who", "whom", "whose",
  "where", "when", "why", "how", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "no", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "also", "about",
  "above", "after", "again", "against", "along", "among", "any", "as",
  "at", "before", "below", "between", "but", "by", "down", "during",
  "for", "from", "if", "in", "into", "of", "off", "on", "or", "out",
  "over", "per", "through", "to", "under", "until", "up", "with",
  "and", "here", "there", "then", "now", "well", "many", "much",
  "even", "still", "already", "often", "however", "while", "since",
  "though", "because", "although", "whether", "yet", "like", "one",
  "two", "three", "four", "five", "first", "second", "third",
  "new", "old", "good", "great", "best", "better", "high", "low",
  "make", "made", "get", "got", "take", "come", "see", "know",
  "think", "look", "want", "give", "use", "find", "tell", "ask",
  "work", "seem", "feel", "try", "say", "said", "go", "going",
  "based", "include", "including", "including", "overall", "example",
  "note", "particularly", "especially", "generally", "typically",
  "available", "various", "several", "different", "specific",
  "important", "popular", "known", "offer", "offers", "offering",
  "provide", "provides", "providing", "strong", "excellent",
  "really", "quite", "rather", "always", "never", "sometimes",
  "keep", "thing", "things", "way", "ways", "lot", "part",
  "number", "year", "years", "time", "times", "long", "right",
  "sure", "given", "data", "information", "answer", "question",
]);

// Phrases to skip — too generic or structural
const SKIP_PHRASES = new Set([
  "mobile phone", "phone brand", "phone brands", "mobile phone brand",
  "mobile phone brands", "top brands", "leading brands", "major brands",
  "brand name", "brand names", "market share", "market leader",
  "price range", "price point", "price segment", "service center",
  "service centers", "customer service", "customer support",
]);

export function extractKeywords(
  brandName: string,
  competitorNames: string[],
  results: { aiTool: string; rawResponse: string; brandMentioned: boolean; errorMessage: string | null }[]
): KeywordAnalysis {
  const okResults = results.filter((r) => !r.errorMessage && r.rawResponse);
  const allNames = [brandName, ...competitorNames].map((n) => n.toLowerCase());

  // For each response, find paragraphs/sentences mentioning each entity
  // and extract descriptive phrases from them
  const brandPhrases = new Map<string, number>();
  const competitorPhrases = new Map<string, { count: number; names: Set<string> }>();

  for (const result of okResults) {
    const text = result.rawResponse;
    const sentences = splitSentences(text);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const mentionsBrand = mentionsEntity(lower, brandName);
      const mentionedCompetitors = competitorNames.filter((c) => mentionsEntity(lower, c));

      const phrases = extractPhrases(sentence);

      if (mentionsBrand) {
        for (const phrase of phrases) {
          if (isEntityName(phrase, allNames)) continue;
          brandPhrases.set(phrase, (brandPhrases.get(phrase) ?? 0) + 1);
        }
      }

      for (const comp of mentionedCompetitors) {
        for (const phrase of phrases) {
          if (isEntityName(phrase, allNames)) continue;
          const entry = competitorPhrases.get(phrase) ?? { count: 0, names: new Set() };
          entry.count++;
          entry.names.add(comp);
          competitorPhrases.set(phrase, entry);
        }
      }
    }
  }

  // Brand keywords: phrases appearing 2+ times near the brand
  const brandKeywords: KeywordEntry[] = Array.from(brandPhrases.entries())
    .filter(([, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count, associatedWith: [brandName] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Competitor keywords: phrases appearing 2+ times near competitors
  const competitorKeywords: KeywordEntry[] = Array.from(competitorPhrases.entries())
    .filter(([, entry]) => entry.count >= 2)
    .map(([phrase, entry]) => ({
      phrase,
      count: entry.count,
      associatedWith: Array.from(entry.names),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Gaps: phrases competitors own but the brand doesn't
  const brandPhraseSet = new Set(brandPhrases.keys());
  const gaps: KeywordEntry[] = competitorKeywords
    .filter((ck) => !brandPhraseSet.has(ck.phrase))
    .slice(0, 15);

  // Target keywords: combine gaps + low-frequency brand phrases for content strategy
  const targetKeywords = gaps
    .slice(0, 10)
    .map((g) => g.phrase);

  return { brandKeywords, competitorKeywords, gaps, targetKeywords };
}

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation, bullet points, newlines
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.replace(/^[\s*#\-–—•·▸→>]+/, "").trim())
    .filter((s) => s.length > 10);
}

function mentionsEntity(lowerText: string, entityName: string): boolean {
  const lower = entityName.toLowerCase();
  // Handle multi-word names
  if (lowerText.includes(lower)) return true;
  // Handle cases like "OPPO" appearing as "Oppo"
  const words = lower.split(/\s+/);
  if (words.length === 1) {
    const pattern = new RegExp(`\\b${escapeRegex(lower)}\\b`, "i");
    return pattern.test(lowerText);
  }
  return false;
}

function isEntityName(phrase: string, allNames: string[]): boolean {
  const lower = phrase.toLowerCase();
  return allNames.some(
    (name) => lower === name || lower.includes(name) || name.includes(lower)
  );
}

function extractPhrases(sentence: string): string[] {
  const phrases: string[] = [];
  // Clean the sentence
  const cleaned = sentence
    .replace(/\*\*/g, "")
    .replace(/[#*_`~]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();

  // Extract bigrams and trigrams
  const words = cleaned
    .split(/[\s,;:]+/)
    .map((w) => w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ""))
    .filter((w) => w.length > 1);

  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n);
      const allStop = ngram.every((w) => STOPWORDS.has(w.toLowerCase()));
      if (allStop) continue;
      // At least one non-stopword
      const hasContent = ngram.some((w) => !STOPWORDS.has(w.toLowerCase()) && w.length > 2);
      if (!hasContent) continue;

      const phrase = ngram.join(" ").toLowerCase();
      if (SKIP_PHRASES.has(phrase)) continue;
      if (phrase.length < 5) continue;

      phrases.push(phrase);
    }
  }

  // Also extract adjective-noun style descriptors via pattern matching
  const descriptorPattern = /\b(affordable|premium|budget|flagship|mid-range|midrange|high-end|camera|battery|display|screen|gaming|performance|5g|fast|reliable|durable|innovative|sleek|stylish|compact|lightweight|waterproof|water-resistant|foldable|ai-powered|ai|smart|trusted|quality|value|local|global|chinese|korean|japanese|indonesian)\s+(phone[s]?|device[s]?|brand[s]?|option[s]?|choice[s]?|smartphone[s]?|experience|quality|performance|life|design|technology|features?|camera[s]?|charging|display|screen|model[s]?|series|product[s]?|ecosystem|network|presence|support|warranty|pricing|segment)\b/gi;

  let match;
  while ((match = descriptorPattern.exec(cleaned)) !== null) {
    const phrase = match[0].toLowerCase();
    if (!SKIP_PHRASES.has(phrase) && phrase.length >= 5) {
      phrases.push(phrase);
    }
  }

  return [...new Set(phrases)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
