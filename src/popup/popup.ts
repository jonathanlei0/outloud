// Popup script for OutLoud extension with Cartesia TTS
interface VoiceSettings {
  rate: number;
  voice: string;
}

let currentSettings: VoiceSettings = {
  rate: 1,
  voice: ''
};

// DOM elements
const speakSelectedBtn = document.getElementById('speakSelected') as HTMLButtonElement;
const stopSpeakingBtn = document.getElementById('stopSpeaking') as HTMLButtonElement;
const rateSlider = document.getElementById('rate') as HTMLInputElement;
const voiceSelect = document.getElementById('voice') as HTMLSelectElement;
const rateValue = document.getElementById('rateValue') as HTMLSpanElement;

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
          { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en' }
        ]);
      }
    });
  } else {
    // Fallback to hardcoded voices if no valid tab
    populateVoiceSelect([
      { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en' },
      { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en' },
      { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en' },
      { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en' }
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
  voiceSelect.innerHTML = '<option value="">Default Voice</option>';
  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.id;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });
  
  // Set current selection
  voiceSelect.value = currentSettings.voice;
}

function setupEventListeners() {
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
  rateSlider.addEventListener('input', () => {
    currentSettings.rate = parseFloat(rateSlider.value);
    updateUI();
    saveSettings();
  });
  
  voiceSelect.addEventListener('change', () => {
    currentSettings.voice = voiceSelect.value;
    saveSettings();
  });
}

function updateUI() {
  rateSlider.value = currentSettings.rate.toString();
  voiceSelect.value = currentSettings.voice;
  
  rateValue.textContent = `${currentSettings.rate}x`;
} 