// Cartesia TTS API service
export interface CartesiaVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
}

export interface CartesiaTTSRequest {
  text: string;
  voiceId?: string;
  speed?: number;
}

// API key injected at build time from environment variable
declare const __CARTESIA_API_KEY__: string;
const CARTESIA_API_KEY = __CARTESIA_API_KEY__;

// Log API key status (first 10 characters for security)
console.log('🔑 Cartesia API key loaded:', CARTESIA_API_KEY ? `${CARTESIA_API_KEY.substring(0, 10)}...` : 'NOT LOADED');

export class CartesiaService {
  private static readonly API_BASE = 'https://api.cartesia.ai';
  private static readonly API_VERSION = '2025-04-16';
  
  // Popular Cartesia voice IDs - you can expand this list
  static readonly VOICES: CartesiaVoice[] = [
    { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en', gender: 'neutral' },
    { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en', gender: 'male' },
    { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en', gender: 'female' },
    { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en', gender: 'male' }
  ];
  
  static async generateSpeech(request: CartesiaTTSRequest): Promise<ArrayBuffer> {
    console.log('🎯 CartesiaService.generateSpeech called');
    console.log('Request:', { text: request.text.substring(0, 50) + '...', voiceId: request.voiceId, speed: request.speed });
    
    if (!CARTESIA_API_KEY) {
      const error = 'Cartesia API key not configured. Please set CARTESIA_API_KEY in your .env file.';
      console.error('❌', error);
      throw new Error(error);
    }
    
    const voiceId = request.voiceId || CartesiaService.VOICES[0].id;
    
    // Adjust speed by modifying the transcript (Cartesia doesn't have direct speed control)
    // We can use SSML-like markup or adjust the text
    let transcript = request.text;
    if (request.speed && request.speed !== 1) {
      // For now, we'll just pass the text as-is
      // In a full implementation, you might want to use SSML or other speed controls
      transcript = request.text;
    }
    
    const requestBody = {
      model_id: 'sonic-2',
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
      language: 'en'
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
} 