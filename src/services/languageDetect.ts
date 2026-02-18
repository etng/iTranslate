const JAPANESE_PATTERN = /[\u3040-\u30ff]/g;
const KOREAN_PATTERN = /[\uac00-\ud7af]/g;
const CYRILLIC_PATTERN = /[\u0400-\u04ff]/g;
const HAN_PATTERN = /[\u4e00-\u9fff]/g;
const LATIN_PATTERN = /[a-z]/gi;

const TRADITIONAL_HINT_PATTERN = /[繁體萬與為這後發國語龍門臺學車點]/g;
const SIMPLIFIED_HINT_PATTERN = /[简体万与为这后发国语龙门台学车点]/g;

const FRENCH_HINTS = [" le ", " la ", " les ", " des ", " une ", " que ", " est ", " dans "];
const GERMAN_HINTS = [" der ", " die ", " das ", " und ", " ist ", " nicht ", " mit ", " ein "];
const SPANISH_HINTS = [" el ", " la ", " los ", " las ", " una ", " que ", " de ", " para "];
const ENGLISH_HINTS = [" the ", " and ", " is ", " are ", " of ", " to ", " in ", " with "];

function normalizeText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]*?\]\([^)]+?\)/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/^>\s?/gm, " ")
    .replace(/[-*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function scoreByHints(text: string, hints: string[]): number {
  return hints.reduce((score, word) => {
    return score + (text.includes(word) ? 1 : 0);
  }, 0);
}

export function detectSourceLanguage(input: string): string | null {
  const text = normalizeText(input);
  if (text.length < 8) {
    return null;
  }

  const japaneseCount = countMatches(text, JAPANESE_PATTERN);
  if (japaneseCount > 0) {
    return "Japanese";
  }

  const koreanCount = countMatches(text, KOREAN_PATTERN);
  if (koreanCount > 0) {
    return "Korean";
  }

  const cyrillicCount = countMatches(text, CYRILLIC_PATTERN);
  if (cyrillicCount > 0) {
    return "Russian";
  }

  const hanCount = countMatches(text, HAN_PATTERN);
  if (hanCount > 0) {
    const traditionalCount = countMatches(text, TRADITIONAL_HINT_PATTERN);
    const simplifiedCount = countMatches(text, SIMPLIFIED_HINT_PATTERN);
    if (traditionalCount > simplifiedCount + 1) {
      return "Traditional Chinese";
    }
    return "Simplified Chinese";
  }

  const latinCount = countMatches(text, LATIN_PATTERN);
  if (latinCount < 12) {
    return null;
  }

  const lower = ` ${text.toLowerCase()} `;
  const scored = [
    { language: "French", score: scoreByHints(lower, FRENCH_HINTS) },
    { language: "German", score: scoreByHints(lower, GERMAN_HINTS) },
    { language: "Spanish", score: scoreByHints(lower, SPANISH_HINTS) },
    { language: "English", score: scoreByHints(lower, ENGLISH_HINTS) },
  ].sort((a, b) => b.score - a.score);

  if (scored[0].score === 0) {
    return "English";
  }
  return scored[0].language;
}
