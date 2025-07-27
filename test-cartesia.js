// Test script for Cartesia API integration
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

if (!CARTESIA_API_KEY) {
    console.error('❌ CARTESIA_API_KEY not found in .env file');
    console.log('Please create a .env file with: CARTESIA_API_KEY=your_actual_key');
    process.exit(1);
}

async function testCartesiaAPI() {
    const requestBody = {
        model_id: 'sonic-2',
        transcript: 'Hello, world! This is a test of the Cartesia text-to-speech API.',
        voice: {
            mode: 'id',
            id: '694f9389-aac1-45b6-b726-9d9369183238'
        },
        output_format: {
            container: 'mp3',
            bit_rate: 128000,
            sample_rate: 44100
        },
        language: 'en'
    };

    try {
        console.log('Testing Cartesia API...');
        console.log('Using API key:', CARTESIA_API_KEY.substring(0, 10) + '...');

        const response = await fetch('https://api.cartesia.ai/tts/bytes', {
            method: 'POST',
            headers: {
                'Cartesia-Version': '2025-04-16',
                'Authorization': `Bearer ${CARTESIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, response.statusText);
            console.error('Error body:', errorText);
            return;
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Success! Received audio buffer of size:', audioBuffer.byteLength, 'bytes');

        console.log('✅ Cartesia API is working! You can now build and test the extension.');

    } catch (error) {
        console.error('❌ Error testing Cartesia API:', error);
    }
}

// Run the test
testCartesiaAPI(); 