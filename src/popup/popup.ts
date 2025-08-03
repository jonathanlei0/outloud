// Popup script for OutLoud extension with Cartesia TTS - Chinese only
import { SupportedLanguage } from '../utils/languageDetection.js';

type SpeedSetting = 'slow' | 'normal' | 'fast';

interface VoiceSettings {
  speed: SpeedSetting;
  voice: string;
  isEnabled: boolean;
}

let currentSettings: VoiceSettings = {
  speed: 'normal',
  voice: '',
  isEnabled: false
};

// DOM elements
const speakSelectedBtn = document.getElementById('speakSelected') as HTMLButtonElement;
const stopSpeakingBtn = document.getElementById('stopSpeaking') as HTMLButtonElement;
const speedSelect = document.getElementById('speed') as HTMLSelectElement;
const voiceSelect = document.getElementById('voice') as HTMLSelectElement;
const enableSwitch = document.getElementById('enableSwitch') as HTMLInputElement;

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
  
  // Notify content script about setting changes
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && await isContentScriptReady(tab.id)) {
    sendMessageToTab(tab.id, { 
      type: 'UPDATE_SETTINGS', 
      settings: currentSettings 
    });
  }
}

async function loadVoices() {
  // Get available voices from content script (Chinese voices only)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && await isContentScriptReady(tab.id)) {
    sendMessageToTab(tab.id, { type: 'GET_VOICES' }, (response) => {
      if (response && response.voices) {
        populateVoiceSelect(response.voices);
      } else {
        // Fallback to hardcoded Chinese voices
        populateVoiceSelect([
          { id: 'c59c247b-6aa9-4ab6-91f9-9eabea7dc69e', name: 'Chinese Lecturer Male', language: 'zh', gender: 'male' },
          { id: '7a5d4663-88ae-47b7-808e-8f9b9ee4127b', name: 'Chinese Upbeat Female', language: 'zh', gender: 'female' },
          { id: 'eda5bbff-1ff1-4886-8ef1-4e69a77640a0', name: 'Chinese News Male', language: 'zh', gender: 'male' },
          { id: 'bf32f849-7bc9-4b91-8c62-954588efcc30', name: 'Chinese Normal Male', language: 'zh', gender: 'male' }
        ]);
      }
    });
  } else {
    // Fallback to hardcoded Chinese voices
    populateVoiceSelect([
      { id: 'c59c247b-6aa9-4ab6-91f9-9eabea7dc69e', name: 'Chinese Lecturer Male', language: 'zh', gender: 'male' },
      { id: '7a5d4663-88ae-47b7-808e-8f9b9ee4127b', name: 'Chinese Upbeat Female', language: 'zh', gender: 'female' },
      { id: 'eda5bbff-1ff1-4886-8ef1-4e69a77640a0', name: 'Chinese News Male', language: 'zh', gender: 'male' },
      { id: 'bf32f849-7bc9-4b91-8c62-954588efcc30', name: 'Chinese Normal Male', language: 'zh', gender: 'male' }
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
  voiceSelect.innerHTML = '<option value="">Default Chinese Voice</option>';
  
  // Only show Chinese voices
  const chineseVoices = voices.filter(v => v.language === 'zh');
  
  chineseVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.id;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });
  
  // Set current selection
  voiceSelect.value = currentSettings.voice;
}

function setupEventListeners() {
  // Enable/disable toggle
  enableSwitch.addEventListener('change', () => {
    currentSettings.isEnabled = enableSwitch.checked;
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
        options: {
          ...currentSettings,
          language: 'zh'  // Force Chinese
        }
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
              options: {
                ...currentSettings,
                language: 'zh'  // Force Chinese
              }
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
  enableSwitch.checked = currentSettings.isEnabled;
} 