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
    // English voices
    { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en', gender: 'neutral' },
    { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en', gender: 'male' },
    { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en', gender: 'female' },
    { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en', gender: 'male' },
    
    // Chinese voices (Mandarin)
    { id: '87748186-23bb-4158-a1eb-332911b0b708', name: '中文女声', language: 'zh', gender: 'female' },
    { id: 'b9de4a89-2f3e-4f5c-9b8d-7c4a6b2f8e3d', name: '中文男声', language: 'zh', gender: 'male' },
    { id: 'c8ef5b9a-3f4e-5f6d-ac9e-8d5a7c3f9e4f', name: '台湾女声', language: 'zh', gender: 'female' }
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
      const defaultVoice = CartesiaService.VOICES.find(v => v.language === targetLanguage);
      voiceId = defaultVoice?.id || CartesiaService.VOICES[0].id;
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