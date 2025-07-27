// Background service worker for OutLoud extension with Cartesia TTS
import { CartesiaService, CartesiaTTSRequest } from './cartesia.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SPEAK_TEXT') {
    console.log('🎤 Background received SPEAK_TEXT message:', message.text.substring(0, 50) + '...');
    handleSpeakText(message, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'STOP_SPEAKING') {
    handleStopSpeaking(sendResponse);
    return true;
  }
  
  return false;
});

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
      speed: message.options?.speed || 'normal',  // Use speed instead of rate
      language: message.options?.language || 'en'
    };
    
    console.log('🔊 Generating speech with Cartesia for:', message.text.substring(0, 50) + '...');
    console.log('Voice ID:', request.voiceId || 'auto-select');
    console.log('Speed:', request.speed);
    console.log('Language:', request.language);
    
    // Generate MP3 audio using Cartesia
    console.log('📡 Calling Cartesia API...');
    const audioBuffer = await CartesiaService.generateSpeech(request);
    console.log('✅ Received audio buffer:', audioBuffer.byteLength, 'bytes');
    
    // Convert ArrayBuffer to base64 for transmission
    console.log('🔄 Converting to base64...');
    const base64Audio = arrayBufferToBase64(audioBuffer);
    console.log('✅ Base64 conversion complete:', base64Audio.length, 'characters');
    
    // Send audio to content script to play
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Ensure content script is ready first
      const isReady = await ensureContentScriptReady(tab.id);
      if (!isReady) {
        console.error('❌ Could not prepare content script');
        sendResponse({ 
          success: false, 
          error: 'Could not prepare audio playback. Make sure you\'re on a regular webpage.' 
        });
        return;
      }
      
      // Try to send audio with retries
      const success = await sendAudioToContentScript(tab.id, base64Audio);
      if (success) {
        sendResponse({ success: true });
      } else {
        sendResponse({ 
          success: false, 
          error: 'Could not play audio. Make sure you\'re on a regular webpage and try again.' 
        });
      }
    } else {
      console.error('❌ No active tab found');
      sendResponse({ 
        success: false, 
        error: 'No active tab found' 
      });
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

console.log('OutLoud background service worker loaded with Cartesia TTS'); 