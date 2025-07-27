// Content script for OutLoud extension with Cartesia audio playback
let currentAudio: HTMLAudioElement | null = null;

// Listen for text selection
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection()?.toString().trim();
  if (selectedText && selectedText.length > 0) {
    // Store selected text for potential reading
    chrome.storage.local.set({ lastSelectedText: selectedText });
  }
});

// Listen for keyboard shortcut (Ctrl+Shift+S or Cmd+Shift+S)
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      // Send to background script to generate speech
      chrome.runtime.sendMessage({
        type: 'SPEAK_TEXT',
        text: selectedText,
        options: {}
      });
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
    // Return Cartesia voices instead of browser voices
    const cartesiaVoices = [
      { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Default Voice', language: 'en' },
      { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'British Male', language: 'en' },
      { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'American Female', language: 'en' },
      { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', name: 'Australian Male', language: 'en' }
    ];
    sendResponse({ voices: cartesiaVoices });
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

console.log('OutLoud content script loaded with Cartesia audio support'); 