// Content script for OutLoud extension with Cartesia audio playback
import { detectLanguage, SupportedLanguage } from '../utils/languageDetection.js';
import { SpeedSetting } from '../cartesia.js';

let currentAudio: HTMLAudioElement | null = null;
let autoReadSettings = {
  autoRead: false,
  languageDetection: 'auto' as 'auto' | 'en' | 'zh',
  speed: 'normal' as SpeedSetting,
  voice: ''
};

// Load settings when content script initializes
chrome.storage.local.get(['voiceSettings']).then(result => {
  if (result.voiceSettings) {
    autoReadSettings = { ...autoReadSettings, ...result.voiceSettings };
    console.log('🔧 Auto-read settings loaded:', autoReadSettings);
  }
});

// Listen for text selection
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection()?.toString().trim();
  if (selectedText && selectedText.length > 0) {
    // Store selected text for potential reading
    chrome.storage.local.set({ lastSelectedText: selectedText });
    
    // Auto-read if enabled
    if (autoReadSettings.autoRead) {
      console.log('🤖 Auto-read triggered for:', selectedText.substring(0, 50) + '...');
      console.log('🏃 Using speed setting:', autoReadSettings.speed);
      autoReadSelectedText(selectedText);
    }
  }
});

function autoReadSelectedText(text: string) {
  // Determine language based on settings
  let detectedLanguage: SupportedLanguage;
  
  if (autoReadSettings.languageDetection === 'auto') {
    const detection = detectLanguage(text);
    detectedLanguage = detection.language;
    console.log('🔍 Language detected:', detectedLanguage, `(${Math.round(detection.confidence * 100)}% confidence)`);
  } else {
    detectedLanguage = autoReadSettings.languageDetection as SupportedLanguage;
    console.log('🔧 Language forced to:', detectedLanguage);
  }
  
  console.log('🎵 Auto-read will use settings:', {
    speed: autoReadSettings.speed,
    voice: autoReadSettings.voice || 'auto-select',
    language: detectedLanguage
  });
  
  // Send to background script to generate speech with detected language
  chrome.runtime.sendMessage({
    type: 'SPEAK_TEXT',
    text: text,
    options: {
      ...autoReadSettings,
      language: detectedLanguage
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error in auto-read:', chrome.runtime.lastError.message);
    } else if (response && !response.success) {
      console.error('Auto-read failed:', response.error);
    } else {
      console.log('✅ Auto-read successful with speed:', autoReadSettings.speed);
    }
  });
}

// Listen for keyboard shortcut (Ctrl+Shift+S or Cmd+Shift+S)
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      console.log('⌨️ Keyboard shortcut triggered with speed:', autoReadSettings.speed);
      // For manual trigger, also use language detection
      autoReadSelectedText(selectedText);
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    // Respond to ping to confirm content script is ready
    sendResponse({ ready: true });
    return true;
  }
  
  if (message.type === 'PLAY_AUDIO') {
    console.log('Content script received PLAY_AUDIO message');
    console.log('Audio data length:', message.audioData ? message.audioData.length : 'undefined');
    console.log('MIME type:', message.mimeType);
    playAudio(message.audioData, message.mimeType);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'STOP_AUDIO') {
    stopAudio();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_SELECTION') {
    const selectedText = window.getSelection()?.toString().trim();
    sendResponse({ text: selectedText || '' });
    return true;
  }
  
  if (message.type === 'GET_VOICES') {
    // Return Cartesia voices for both English and Chinese
    const cartesiaVoices = [
      // English voices
      { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en' },
      { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en' },
      { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en' },
      { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en' },
      // Chinese voices
      { id: '87748186-23bb-4158-a1eb-332911b0b708', name: '中文女声', language: 'zh' },
      { id: 'b9de4a89-2f3e-4f5c-9b8d-7c4a6b2f8e3d', name: '中文男声', language: 'zh' },
      { id: 'c8ef5b9a-3f4e-5f6d-ac9e-8d5a7c3f9e4f', name: '台湾女声', language: 'zh' }
    ];
    sendResponse({ voices: cartesiaVoices });
    return true;
  }
  
  if (message.type === 'UPDATE_AUTO_READ_SETTINGS') {
    console.log('🔧 Updating auto-read settings:', message.settings);
    console.log('🏃 Speed changed from', autoReadSettings.speed, 'to', message.settings.speed);
    autoReadSettings = { ...autoReadSettings, ...message.settings };
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

function playAudio(base64Data: string, mimeType: string) {
  console.log('🎵 playAudio function called');
  console.log('Base64 data received:', base64Data ? `${base64Data.length} characters` : 'null/undefined');
  console.log('MIME type:', mimeType);
  
  try {
    // Stop any currently playing audio
    stopAudio();
    
    if (!base64Data) {
      console.error('❌ No audio data provided');
      return;
    }
    
    console.log('🔄 Converting base64 to blob...');
    
    // Convert base64 to blob
    const binaryString = atob(base64Data);
    console.log('Binary string length:', binaryString.length);
    
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    console.log('Blob created:', blob.size, 'bytes, type:', blob.type);
    
    // Create audio element and play
    currentAudio = new Audio();
    const audioUrl = URL.createObjectURL(blob);
    currentAudio.src = audioUrl;
    
    console.log('🎧 Audio element created with URL:', audioUrl);
    
    currentAudio.onloadstart = () => {
      console.log('🔄 Audio loading started');
    };
    
    currentAudio.oncanplay = () => {
      console.log('✅ Audio can play');
    };
    
    currentAudio.onplay = () => {
      console.log('▶️ Started playing Cartesia audio');
    };
    
    currentAudio.onended = () => {
      console.log('⏹️ Finished playing audio');
      cleanupAudio();
    };
    
    currentAudio.onerror = (error) => {
      console.error('❌ Audio playback error:', error);
      console.error('Audio error event:', currentAudio?.error);
      cleanupAudio();
    };
    
    currentAudio.onabort = () => {
      console.log('⏸️ Audio playback aborted');
    };
    
    currentAudio.onstalled = () => {
      console.log('⏳ Audio playback stalled');
    };
    
    // Set volume to ensure it's audible
    currentAudio.volume = 1.0;
    
    console.log('🚀 Attempting to play audio...');
    // Play the audio
    currentAudio.play().then(() => {
      console.log('✅ Audio play() promise resolved');
    }).catch(error => {
      console.error('❌ Failed to play audio:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      cleanupAudio();
    });
    
  } catch (error) {
    console.error('❌ Error in playAudio function:', error);
  }
}

function stopAudio() {
  if (currentAudio) {
    console.log('⏹️ Stopping audio');
    currentAudio.pause();
    currentAudio.currentTime = 0;
    cleanupAudio();
  }
}

function cleanupAudio() {
  if (currentAudio) {
    console.log('🧹 Cleaning up audio');
    if (currentAudio.src) {
      URL.revokeObjectURL(currentAudio.src);
    }
    currentAudio = null;
  }
}

console.log('OutLoud content script loaded with Cartesia audio support and auto-read functionality'); 