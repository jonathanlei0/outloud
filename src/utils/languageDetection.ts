// Language detection utility for English and Chinese text
export type SupportedLanguage = 'en' | 'zh';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
}

/**
 * Detects if text is primarily English or Chinese
 * @param text The text to analyze
 * @returns Language detection result
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0 };
  }
  
  const cleanText = text.trim();
  
  // Count Chinese characters (CJK Unified Ideographs)
  const chineseCharRegex = /[\u4e00-\u9fff]/g;
  const chineseMatches = cleanText.match(chineseCharRegex);
  const chineseCharCount = chineseMatches ? chineseMatches.length : 0;
  
  // Count English letters
  const englishCharRegex = /[a-zA-Z]/g;
  const englishMatches = cleanText.match(englishCharRegex);
  const englishCharCount = englishMatches ? englishMatches.length : 0;
  
  // Count total meaningful characters (excluding spaces, punctuation)
  const meaningfulCharRegex = /[\u4e00-\u9fff]|[a-zA-Z]/g;
  const meaningfulMatches = cleanText.match(meaningfulCharRegex);
  const totalMeaningfulChars = meaningfulMatches ? meaningfulMatches.length : 0;
  
  if (totalMeaningfulChars === 0) {
    // No meaningful characters, default to English
    return { language: 'en', confidence: 0.1 };
  }
  
  const chineseRatio = chineseCharCount / totalMeaningfulChars;
  const englishRatio = englishCharCount / totalMeaningfulChars;
  
  // If more than 30% Chinese characters, consider it Chinese
  if (chineseRatio > 0.3) {
    return { 
      language: 'zh', 
      confidence: Math.min(0.9, 0.5 + chineseRatio) 
    };
  }
  
  // If more than 70% English characters, consider it English
  if (englishRatio > 0.7) {
    return { 
      language: 'en', 
      confidence: Math.min(0.9, 0.5 + englishRatio) 
    };
  }
  
  // Mixed content - prefer the dominant language
  if (chineseCharCount > englishCharCount) {
    return { 
      language: 'zh', 
      confidence: 0.6 
    };
  } else {
    return { 
      language: 'en', 
      confidence: 0.6 
    };
  }
}

/**
 * Get language name for display
 */
export function getLanguageName(language: SupportedLanguage): string {
  switch (language) {
    case 'en':
      return 'English';
    case 'zh':
      return '中文';
    default:
      return 'Unknown';
  }
}

/**
 * Test the language detection with sample texts
 */
export function testLanguageDetection() {
  const tests = [
    'Hello world, this is a test.',
    '你好世界，这是一个测试。',
    'Hello 你好 world 世界',
    '这是中文 with some English words',
    'Mostly English text with one 字',
    '主要是中文文本 with one word',
    '',
    '123 !@# $%^',
    'JavaScript is a programming language',
    '人工智能技术发展迅速'
  ];
  
  console.log('Language Detection Tests:');
  tests.forEach(text => {
    const result = detectLanguage(text);
    console.log(`"${text}" -> ${result.language} (${Math.round(result.confidence * 100)}%)`);
  });
} 