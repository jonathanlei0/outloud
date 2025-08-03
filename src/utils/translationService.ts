// A simple service for translating text using a public Google Translate API
export type SupportedLanguage = 'zh' | 'en';

export class TranslationService {
  /**
   * Translates text from a source language to a target language.
   * @param text The text to translate.
   * @param sourceLang The source language ('zh' for Chinese).
   * @param targetLang The target language ('en' for English).
   * @returns The translated text.
   */
  static async translate(
    text: string, 
    sourceLang: SupportedLanguage, 
    targetLang: 'en'
  ): Promise<string> {
    if (!text) {
      return '';
    }

    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.append('client', 'gtx');
    url.searchParams.append('sl', 'zh'); // Force source language to Chinese
    url.searchParams.append('tl', targetLang);
    url.searchParams.append('dt', 't');
    url.searchParams.append('q', text);

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }
      const data = await response.json();
      
      // The response is a nested array, the translated text is in the first part.
      const translatedText = data[0].map((item: any) => item[0]).join('');
      console.log(`✅ Translation successful (forced zh): "${text}" -> "${translatedText}"`);
      return translatedText;

    } catch (error) {
      console.error('❌ Error calling Translation API:', error);
      // Return the original text on failure
      return text;
    }
  }
} 