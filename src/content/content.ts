// Content script for OutLoud extension with Cartesia audio playback - Chinese only
import { SpeedSetting } from '../cartesia.js';

let currentAudio: HTMLAudioElement | null = null;
let currentSettings = {
  isEnabled: false,
  speed: 'normal' as SpeedSetting,
  voice: ''
};
let lastProcessedText: string = '';
let selectionTimeout: number | undefined;
let fullAudioBlobUrl: string | null = null;

// Load settings when content script initializes
chrome.storage.local.get(['voiceSettings']).then(result => {
  if (result.voiceSettings) {
    currentSettings = { ...currentSettings, ...result.voiceSettings };
    console.log('🔧 Settings loaded:', currentSettings);
  }
});

document.addEventListener('selectionchange', () => {
    if (selectionTimeout) {
        clearTimeout(selectionTimeout);
    }

    if (!currentSettings.isEnabled) {
        return;
    }

    selectionTimeout = window.setTimeout(() => {
        const selection = window.getSelection();

        if (!selection) {
            return;
        }

        const currentText = selection ? selection.toString() : ''; // Keep whitespace for diffing

        // Check if the selection is more than 10 characters - save on API calls!
        if (currentText.length > 100) {
            return;
        }

        // Check if the selection starts with a Chinese character
        if (currentText.length > 0 && !currentText.match(/^[\u4e00-\u9fa5]/)) {
            return;
        }

        if (currentText !== lastProcessedText) {
            const textToSpeak = getTextToSpeak(lastProcessedText, currentText);

            if (textToSpeak.trim().length > 0) {
                console.log('✨ New selection to process:', { full: currentText, diff: textToSpeak });
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                autoReadSelectedText(textToSpeak, currentText, rect);
            } else {
                // If the new selection is empty or shouldn't be read, stop any current audio.
                stopAudio();
            }
            lastProcessedText = currentText;
        }
    }, 250); // Debounce to handle rapid changes
});


function getTextToSpeak(oldText: string, newText: string): string {
    console.log('🔍 getTextToSpeak called:', { oldText: `"${oldText}"`, newText: `"${newText}"` });
    
    if (!newText.trim()) {
        console.log('📝 New text is empty, returning empty');
        return '';
    }

    if (!oldText.trim()) {
        console.log('📝 First selection, returning new text');
        return newText;
    }

    // Extending selection forward
    if (newText.length > oldText.length && newText.startsWith(oldText)) {
        const added = newText.substring(oldText.length);
        console.log('📈 Extended forward, added:', `"${added}"`);
        return added;
    }
    // Extending selection backward
    if (newText.length > oldText.length && newText.endsWith(oldText)) {
        const added = newText.substring(0, newText.length - oldText.length);
        console.log('📈 Extended backward, added:', `"${added}"`);
        return added;
    }
    // Shrinking selection from the end (e.g., "hello I am" -> "hello I")
    if (newText.length < oldText.length && oldText.startsWith(newText)) {
        const removedText = oldText.substring(newText.length);
        console.log('📉 Selection shrunk from end, reading removed text:', `"${removedText}"`);
        return removedText.trim();
    }
    // Shrinking selection from the beginning (e.g., "hello I am" -> "I am")
    if (newText.length < oldText.length && oldText.endsWith(newText)) {
        const removedText = oldText.substring(0, oldText.length - newText.length);
        console.log('📉 Selection shrunk from beginning, reading removed text:', `"${removedText}"`);
        return removedText.trim();
    }
    
    // For completely different selections, read the new one
    console.log('📝 Completely different selection, reading new text');
    return newText;
}


function autoReadSelectedText(textToSpeak: string, fullText: string, selectionRect: DOMRect) {
  // Check if this is a shrinking operation by comparing textToSpeak with fullText
  const isShrinking = textToSpeak !== fullText && textToSpeak.trim().length > 0 && 
                     (fullText.length === 0 || !fullText.includes(textToSpeak.trim()));
  
  if (isShrinking) {
    console.log('📉 Shrinking selection detected, only processing removed text');
    // For shrinking, only process the removed text (textToSpeak)
    chrome.runtime.sendMessage({
      type: 'PROCESS_SELECTION_CHANGE',
      textToSpeak: textToSpeak,
      textToTranslate: textToSpeak, // Use the same text for translation
      options: {
        ...currentSettings,
        language: 'zh'
      },
      selectionRect: {
        top: selectionRect.top + window.scrollY,
        left: selectionRect.left + window.scrollX,
        width: selectionRect.width,
        height: selectionRect.height
      }
    });
  } else {
    console.log('📈 Extending selection or new selection, processing diff and full');
    // For extending or new selections, process both diff and full text
    chrome.runtime.sendMessage({
      type: 'PROCESS_SELECTION_CHANGE',
      textToSpeak: textToSpeak,
      textToTranslate: fullText,
      options: {
        ...currentSettings,
        language: 'zh'
      },
      selectionRect: {
        top: selectionRect.top + window.scrollY,
        left: selectionRect.left + window.scrollX,
        width: selectionRect.width,
        height: selectionRect.height
      }
    });
  }
}

// Listen for keyboard shortcut (Ctrl+Shift+S or Cmd+Shift+S)
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      // Manual trigger doesn't show translation overlay, just speaks
      chrome.runtime.sendMessage({
        type: 'SPEAK_TEXT',
        text: selectedText,
        options: {
          ...currentSettings,
          language: 'zh'
        }
      });
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ready: true });
    return true;
  }
  
  if (message.type === 'PLAY_DIFFERENCE_AND_FULL') {
    playDiffThenFull(message);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'SHOW_TRANSLATION_OVERLAY') {
    showTranslationOverlay(message.translation, message.selectionRect);
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
    const chineseVoices = [
      { id: '87748186-23bb-4158-a1eb-332911b0b708', name: '中文女声', language: 'zh' },
      { id: 'b9de4a89-2f3e-4f5c-9b8d-7c4a6b2f8e3d', name: '中文男声', language: 'zh' },
      { id: 'c8ef5b9a-3f4e-5f6d-ac9e-8d5a7c3f9e4f', name: '台湾女声', language: 'zh' }
    ];
    sendResponse({ voices: chineseVoices });
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    console.log('🔧 Updating settings:', message.settings);
    const wasEnabled = currentSettings.isEnabled;
    currentSettings = { ...currentSettings, ...message.settings };
    
    // If the extension was just disabled, stop any ongoing audio.
    if (wasEnabled && !currentSettings.isEnabled) {
        stopAudio();
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

function showTranslationOverlay(translation: string, rect: any) {
    // Remove existing overlay to prevent duplicates
    dismissTranslationOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'outloud-translation-overlay';
    overlay.textContent = translation;
    
    // Basic styling
    Object.assign(overlay.style, {
        position: 'absolute',
        top: `${rect.top + rect.height}px`,
        left: `${rect.left}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '5px',
        zIndex: '999999',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        maxWidth: '300px',
        textAlign: 'left',
        pointerEvents: 'none'
    });

    document.body.appendChild(overlay);
}

function dismissTranslationOverlay() {
    const overlay = document.getElementById('outloud-translation-overlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
}

function playDiffThenFull(message: any) {
    stopAudio();

    showTranslationOverlay(message.translation, message.selectionRect);

    const fullBinaryString = atob(message.fullAudioData);
    const fullBytes = new Uint8Array(fullBinaryString.length);
    for (let i = 0; i < fullBinaryString.length; i++) {
        fullBytes[i] = fullBinaryString.charCodeAt(i);
    }
    const fullBlob = new Blob([fullBytes], { type: 'audio/mpeg' });
    fullAudioBlobUrl = URL.createObjectURL(fullBlob);

    const diffBinaryString = atob(message.diffAudioData);
    const diffBytes = new Uint8Array(diffBinaryString.length);
    for (let i = 0; i < diffBytes.length; i++) {
        diffBytes[i] = diffBinaryString.charCodeAt(i);
    }

    const diffBlob = new Blob([diffBytes], { type: 'audio/mpeg' });

    // Check if diff and full audio are the same by comparing the base64 strings
    const isDiffSameAsFull = message.diffAudioData === message.fullAudioData;

    currentAudio = new Audio();
    currentAudio.src = URL.createObjectURL(diffBlob);
    currentAudio.playbackRate = 0.75;

    currentAudio.onended = () => {
        if (currentAudio) URL.revokeObjectURL(currentAudio.src);
        
        // Only play the full audio if it's different from the diff audio
        if (!isDiffSameAsFull && fullAudioBlobUrl) {
            currentAudio = new Audio();
            currentAudio.src = fullAudioBlobUrl;
            currentAudio.playbackRate = 0.75;
            currentAudio.onended = () => {
                cleanupAudio();
            };
            currentAudio.play().catch(e => {
                console.error("Failed to play full audio", e);
                cleanupAudio();
            });
        } else {
            // If they're the same, just clean up since we already played it
            cleanupAudio();
        }
    };
    
    currentAudio.play().catch(e => {
        console.error("Failed to play diff audio", e);
        cleanupAudio();
    });
}


function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  cleanupAudio();
}

function cleanupAudio() {
  if (currentAudio) {
    if (currentAudio.src) {
      URL.revokeObjectURL(currentAudio.src);
    }
    currentAudio = null;
  }
  if (fullAudioBlobUrl) {
    URL.revokeObjectURL(fullAudioBlobUrl);
    fullAudioBlobUrl = null;
  }
  dismissTranslationOverlay();
}

console.log('OutLoud content script loaded - Chinese language only'); 