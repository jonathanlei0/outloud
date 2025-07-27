// Popup script for OutLoud extension with Cartesia TTS
import { SupportedLanguage } from '../utils/languageDetection.js';

type SpeedSetting = 'slow' | 'normal' | 'fast';

interface VoiceSettings {
  speed: SpeedSetting;
  voice: string;
  autoRead: boolean;
  languageDetection: 'auto' | 'en' | 'zh';
}

let currentSettings: VoiceSettings = {
  speed: 'normal',
  voice: '',
  autoRead: false,
  languageDetection: 'auto'
};

// DOM elements
const speakSelectedBtn = document.getElementById('speakSelected') as HTMLButtonElement;
const stopSpeakingBtn = document.getElementById('stopSpeaking') as HTMLButtonElement;
const speedSelect = document.getElementById('speed') as HTMLSelectElement;
const voiceSelect = document.getElementById('voice') as HTMLSelectElement;
const autoReadCheckbox = document.getElementById('autoRead') as HTMLInputElement;
const languageDetectionSelect = document.getElementById('languageDetection') as HTMLSelectElement;
const languageDetectionSetting = document.getElementById('languageDetectionSetting') as HTMLDivElement;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadVoices();
  setupEventListeners();
  updateUI();
});

async function loadSettings() {
  const result = await chrome.storage.local.get(['voiceSettings']);
  if (result.voiceSettings) {
    currentSettings = { ...currentSettings, ...result.voiceSettings };
  }
}

async function saveSettings() {
  await chrome.storage.local.set({ voiceSettings: currentSettings });
  
  // Notify content script about auto-read setting change
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && await isContentScriptReady(tab.id)) {
    sendMessageToTab(tab.id, { 
      type: 'UPDATE_AUTO_READ_SETTINGS', 
      settings: currentSettings 
    });
  }
}

async function loadVoices() {
  // Get available voices from content script (now Cartesia voices)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && await isContentScriptReady(tab.id)) {
    sendMessageToTab(tab.id, { type: 'GET_VOICES' }, (response) => {
      if (response && response.voices) {
        populateVoiceSelect(response.voices);
      } else {
        // Fallback to hardcoded voices if content script doesn't respond
        populateVoiceSelect([
          { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en' },
          { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en' },
          { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en' },
          { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en' },
          { id: '87748186-23bb-4158-a1eb-332911b0b708', name: '中文女声', language: 'zh' },
          { id: 'b9de4a89-2f3e-4f5c-9b8d-7c4a6b2f8e3d', name: '中文男声', language: 'zh' }
        ]);
      }
    });
  } else {
    // Fallback to hardcoded voices if no valid tab
    populateVoiceSelect([
      { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en' },
      { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en' },
      { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en' },
      { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en' },
      { id: '87748186-23bb-4158-a1eb-332911b0b708', name: '中文女声', language: 'zh' },
      { id: 'b9de4a89-2f3e-4f5c-9b8d-7c4a6b2f8e3d', name: '中文男声', language: 'zh' }
    ]);
  }
}

async function isContentScriptReady(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not ready:', chrome.runtime.lastError.message);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function sendMessageToTab(tabId: number, message: any, callback?: (response: any) => void) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message to tab:', chrome.runtime.lastError.message);
      if (callback) callback(null);
    } else {
      if (callback) callback(response);
    }
  });
}

function populateVoiceSelect(voices: any[]) {
  voiceSelect.innerHTML = '<option value="">Auto-select by language</option>';
  
  // Group voices by language
  const englishVoices = voices.filter(v => v.language === 'en');
  const chineseVoices = voices.filter(v => v.language === 'zh');
  
  if (englishVoices.length > 0) {
    const englishGroup = document.createElement('optgroup');
    englishGroup.label = 'English';
    englishVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = voice.name;
      englishGroup.appendChild(option);
    });
    voiceSelect.appendChild(englishGroup);
  }
  
  if (chineseVoices.length > 0) {
    const chineseGroup = document.createElement('optgroup');
    chineseGroup.label = '中文';
    chineseVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = voice.name;
      chineseGroup.appendChild(option);
    });
    voiceSelect.appendChild(chineseGroup);
  }
  
  // Set current selection
  voiceSelect.value = currentSettings.voice;
}

function setupEventListeners() {
  // Auto-read toggle
  autoReadCheckbox.addEventListener('change', () => {
    currentSettings.autoRead = autoReadCheckbox.checked;
    updateUI();
    saveSettings();
  });
  
  // Language detection setting
  languageDetectionSelect.addEventListener('change', () => {
    currentSettings.languageDetection = languageDetectionSelect.value as 'auto' | 'en' | 'zh';
    saveSettings();
  });
  
  // Button handlers
  speakSelectedBtn.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['lastSelectedText']);
    const text = result.lastSelectedText;
    
    if (text) {
      chrome.runtime.sendMessage({
        type: 'SPEAK_TEXT',
        text: text,
        options: currentSettings
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background:', chrome.runtime.lastError.message);
          alert('Error: Could not communicate with background script');
        } else if (response && !response.success) {
          alert(`Error: ${response.error}`);
        }
      });
      window.close();
    } else {
      // Try to get current selection
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && await isContentScriptReady(tab.id)) {
        sendMessageToTab(tab.id, { type: 'GET_SELECTION' }, (response) => {
          if (response && response.text) {
            chrome.runtime.sendMessage({
              type: 'SPEAK_TEXT',
              text: response.text,
              options: currentSettings
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error sending message to background:', chrome.runtime.lastError.message);
                alert('Error: Could not communicate with background script');
              } else if (response && !response.success) {
                alert(`Error: ${response.error}`);
              }
            });
            window.close();
          } else {
            alert('Please select some text on the page first.');
          }
        });
      } else {
        alert('Please select some text on the page first, or make sure you\'re on a regular webpage (not a chrome:// page).');
      }
    }
  });
  
  stopSpeakingBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_SPEAKING' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending stop message:', chrome.runtime.lastError.message);
      }
    });
    window.close();
  });
  
  // Settings handlers
  speedSelect.addEventListener('change', () => {
    currentSettings.speed = speedSelect.value as SpeedSetting;
    saveSettings();
  });
  
  voiceSelect.addEventListener('change', () => {
    currentSettings.voice = voiceSelect.value;
    saveSettings();
  });
}

function updateUI() {
  speedSelect.value = currentSettings.speed;
  voiceSelect.value = currentSettings.voice;
  autoReadCheckbox.checked = currentSettings.autoRead;
  languageDetectionSelect.value = currentSettings.languageDetection;
  
  // Show/hide language detection setting based on auto-read toggle
  if (currentSettings.autoRead) {
    languageDetectionSetting.style.display = 'flex';
  } else {
    languageDetectionSetting.style.display = 'none';
  }
} 