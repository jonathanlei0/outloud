// Background service worker for OutLoud extension with Cartesia TTS
import { CartesiaService, CartesiaTTSRequest } from './cartesia.js';
import { TranslationService } from './utils/translationService.js';

const CACHE_LIMIT = 50; // Cache up to 50 items (audio and translations)
const apiCache = new Map<string, { audioBuffer?: ArrayBuffer, translation?: string }>();

function getFromCache(key: string) {
    const item = apiCache.get(key);
    if (item) {
        // Refresh it by deleting and setting again to maintain LRU order
        apiCache.delete(key);
        apiCache.set(key, item);
    }
    return item;
}

function setInCache(key: string, value: { audioBuffer?: ArrayBuffer, translation?: string }) {
    if (apiCache.has(key)) {
        // If key exists, update it, but still respect the LRU logic via getFromCache
        const existing = getFromCache(key) || {};
        apiCache.set(key, { ...existing, ...value });
    } else {
        if (apiCache.size >= CACHE_LIMIT) {
            // Evict the oldest entry
            const oldestKey = apiCache.keys().next().value;
            apiCache.delete(oldestKey);
            console.log(`🗑️ Cache full, evicted: "${oldestKey}"`);
        }
        apiCache.set(key, value);
    }
}

async function getCachedSpeech(text: string, options: any): Promise<ArrayBuffer> {
    const cached = getFromCache(text);
    if (cached?.audioBuffer) {
        console.log(`🎤 Cache HIT for speech: "${text}"`);
        return cached.audioBuffer;
    }
    console.log(`🎤 Cache MISS for speech: "${text}"`);
    const audioBuffer = await CartesiaService.generateSpeech({ ...options, text });
    setInCache(text, { audioBuffer });
    return audioBuffer;
}

async function getCachedTranslation(text: string): Promise<string> {
    const cached = getFromCache(text);
    if (cached?.translation) {
        console.log(`📜 Cache HIT for translation: "${text}"`);
        return cached.translation;
    }
    console.log(`📜 Cache MISS for translation: "${text}"`);
    const translation = await TranslationService.translate(text, 'zh', 'en');
    setInCache(text, { translation });
    return translation;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SPEAK_TEXT') {
    handleSpeakText(message, sendResponse);
    return true;
  }
  
  if (message.type === 'PROCESS_SELECTION_CHANGE') {
    handleProcessSelectionChange(message, sendResponse);
    return true;
  }
  
  if (message.type === 'STOP_SPEAKING') {
    handleStopSpeaking(sendResponse);
    return true;
  }
  
  return false;
});

async function handleProcessSelectionChange(message: any, sendResponse: (response: any) => void) {
    const { textToSpeak, textToTranslate, options, selectionRect } = message;

    // Ensure all options passed to services are explicitly set for Chinese
    const chineseOptions = { ...options, language: 'zh' };

    try {
        let diffAudioBuffer: ArrayBuffer;
        let fullAudioBuffer: ArrayBuffer;
        
        // Check if diff and full text are the same to avoid duplicate API calls
        const isDiffSameAsFull = textToSpeak === textToTranslate;
        
        if (isDiffSameAsFull) {
            console.log('🎤 Diff and full text are identical, making single API call');
            // Only make one speech API call and reuse the result
            const audioBuffer = await getCachedSpeech(textToTranslate, chineseOptions);
            diffAudioBuffer = audioBuffer;
            fullAudioBuffer = audioBuffer;
        } else {
            console.log('🎤 Diff and full text are different, making separate API calls');
            // Make separate calls for diff and full
            const [diffBuffer, fullBuffer] = await Promise.all([
                getCachedSpeech(textToSpeak, chineseOptions),
                getCachedSpeech(textToTranslate, chineseOptions)
            ]);
            diffAudioBuffer = diffBuffer;
            fullAudioBuffer = fullBuffer;
        }

        // Always get translation (this is cached too)
        const translation = await getCachedTranslation(textToTranslate);

        // Convert audio buffers to base64
        const diffAudioData = arrayBufferToBase64(diffAudioBuffer);
        const fullAudioData = arrayBufferToBase64(fullAudioBuffer);

        // Send all data back to the content script in one go
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
                type: 'PLAY_DIFFERENCE_AND_FULL',
                diffAudioData,
                fullAudioData,
                translation,
                selectionRect
            });
        }
        sendResponse({ success: true });
    } catch (error) {
        console.error('❌ Error during selection processing:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
}


async function ensureContentScriptReady(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    // First try to ping the content script
    chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not ready, attempting to inject...');
        // Content script not ready, try to inject it
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to inject content script:', chrome.runtime.lastError.message);
            resolve(false);
          } else {
            console.log('Content script injected, testing again...');
            // Wait a bit for the script to initialize, then test again
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
                resolve(!chrome.runtime.lastError);
              });
            }, 100);
          }
        });
      } else {
        console.log('Content script already ready');
        resolve(true);
      }
    });
  });
}

async function sendAudioToContentScript(tabId: number, audioData: string, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`📤 Attempt ${attempt}/${maxRetries}: Sending audio to content script in tab:`, tabId);
    
    const success = await new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'PLAY_AUDIO',
        audioData: audioData,
        mimeType: 'audio/mpeg'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`❌ Attempt ${attempt} failed:`, chrome.runtime.lastError.message);
          resolve(false);
        } else {
          console.log(`✅ Attempt ${attempt} succeeded: Audio sent to content script`);
          resolve(true);
        }
      });
    });
    
    if (success) {
      return true;
    }
    
    // If failed and not the last attempt, try to ensure content script is ready
    if (attempt < maxRetries) {
      console.log(`🔄 Retrying... ensuring content script is ready first`);
      await ensureContentScriptReady(tabId);
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return false;
}

async function handleSpeakText(message: any, sendResponse: (response: any) => void) {
  try {
    const request: CartesiaTTSRequest = {
      text: message.text,
      voiceId: message.options?.voice,
      speed: message.options?.speed || 'normal',
      language: 'zh' // Force Chinese
    };
    
    const audioBuffer = await getCachedSpeech(message.text, request);
    const base64Audio = arrayBufferToBase64(audioBuffer);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const isReady = await ensureContentScriptReady(tab.id);
      if (isReady) {
        const success = await sendAudioToContentScript(tab.id, base64Audio);
        sendResponse({ success });
      } else {
        sendResponse({ success: false, error: 'Content script not ready.' });
      }
    } else {
      sendResponse({ success: false, error: 'No active tab found.' });
    }
  } catch (error) {
    console.error('❌ Error generating speech:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

async function handleStopSpeaking(sendResponse: (response: any) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'STOP_AUDIO'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending stop message to content script:', chrome.runtime.lastError.message);
          // Still consider it successful since we tried to stop
          sendResponse({ success: true });
        } else {
          sendResponse({ success: true });
        }
      });
    } else {
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Error stopping speech:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup, no additional action needed
});

console.log('OutLoud background service worker loaded with Cartesia TTS and caching'); 