// Cartesia TTS API service
import { SupportedLanguage } from './utils/languageDetection.js';

export type SpeedSetting = 'slow' | 'normal' | 'fast';

export interface CartesiaVoice {
  id: string;
  name: string;
  language: SupportedLanguage;
  gender: string;
}

export interface CartesiaTTSRequest {
  text: string;
  voiceId?: string;
  speed?: SpeedSetting;
  language?: SupportedLanguage;
}

// API key injected at build time from environment variable
declare const __CARTESIA_API_KEY__: string;
const CARTESIA_API_KEY = __CARTESIA_API_KEY__;

// Log API key status (first 10 characters for security)
console.log('🔑 Cartesia API key loaded:', CARTESIA_API_KEY ? `${CARTESIA_API_KEY.substring(0, 10)}...` : 'NOT LOADED');

export class CartesiaService {
  private static readonly API_BASE = 'https://api.cartesia.ai';
  private static readonly API_VERSION = '2025-04-16';
  
  // Cartesia voice IDs for English and Chinese
  static readonly VOICES: CartesiaVoice[] = [
    // Chinese voices (Mandarin)
    { id: 'c59c247b-6aa9-4ab6-91f9-9eabea7dc69e', name: 'Chinese Lecturer Male', language: 'zh', gender: 'male' },
    { id: '7a5d4663-88ae-47b7-808e-8f9b9ee4127b', name: 'Chinese Upbeat Female', language: 'zh', gender: 'female' },
    { id: 'eda5bbff-1ff1-4886-8ef1-4e69a77640a0', name: 'Chinese News Male', language: 'zh', gender: 'male' },
    { id: 'bf32f849-7bc9-4b91-8c62-954588efcc30', name: 'Chinese Normal Male', language: 'zh', gender: 'male' }
  ];
  
  static async generateSpeech(request: CartesiaTTSRequest): Promise<ArrayBuffer> {
    console.log('🎯 CartesiaService.generateSpeech called');
    console.log('Request:', { 
      text: request.text.substring(0, 50) + '...', 
      voiceId: request.voiceId, 
      speed: request.speed,
      language: request.language 
    });
    
    if (!CARTESIA_API_KEY) {
      const error = 'Cartesia API key not configured. Please set CARTESIA_API_KEY in your .env file.';
      console.error('❌', error);
      throw new Error(error);
    }
    
    // Determine language and voice
    const targetLanguage = request.language || 'en';
    let voiceId = request.voiceId;
    
    // If no specific voice is chosen, pick default for the language
    if (!voiceId) {
      voiceId = 'c59c247b-6aa9-4ab6-91f9-9eabea7dc69e';
    }
    
    console.log('🎵 Using voice:', voiceId, 'for language:', targetLanguage);
    console.log('🏃 Speed setting:', request.speed);
    
    // Prepare transcript with speed control
    let transcript = request.text;
    
    // For Cartesia, we can use SSML-like speed control or modify the request
    // Since Cartesia sonic-turbo supports speed control, we'll use it in the request
    
    const requestBody = {
      model_id: 'sonic-turbo',
      transcript: transcript,
      voice: {
        mode: 'id',
        id: voiceId
      },
      output_format: {
        container: 'mp3',
        bit_rate: 128000,
        sample_rate: 44100
      },
      language: targetLanguage === 'zh' ? 'zh' : 'en',
      // Add speed control to the request
      speed: request.speed
    };
    
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    
    try {
      console.log('🌐 Making fetch request to:', `${CartesiaService.API_BASE}/tts/bytes`);
      const response = await fetch(`${CartesiaService.API_BASE}/tts/bytes`, {
        method: 'POST',
        headers: {
          'Cartesia-Version': CartesiaService.API_VERSION,
          'Authorization': `Bearer ${CARTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Cartesia API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('✅ Successfully received audio buffer:', arrayBuffer.byteLength, 'bytes');
      return arrayBuffer;
    } catch (error) {
      console.error('❌ Error calling Cartesia API:', error);
      throw error;
    }
  }
  
  static getVoices(): CartesiaVoice[] {
    return CartesiaService.VOICES;
  }
  
  static getVoicesForLanguage(language: SupportedLanguage): CartesiaVoice[] {
    return CartesiaService.VOICES.filter(voice => voice.language === language);
  }
} 