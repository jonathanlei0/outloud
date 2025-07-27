import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Move popup.html from nested directory to root
const nestedPath = path.resolve(__dirname, 'dist/src/popup/popup.html');
const rootPath = path.resolve(__dirname, 'dist/popup.html');

if (fs.existsSync(nestedPath)) {
    const content = fs.readFileSync(nestedPath, 'utf-8');

    // Fix script and CSS paths to be relative
    const fixedContent = content
        .replace(/src="\/popup\.js"/g, 'src="popup.js"')
        .replace(/href="\/popup\.css"/g, 'href="popup.css"');

    fs.writeFileSync(rootPath, fixedContent);
    console.log('✅ Moved popup.html to dist root and fixed paths');

    // Clean up nested directories
    fs.unlinkSync(nestedPath);
    try {
        fs.rmdirSync(path.resolve(__dirname, 'dist/src/popup'));
        fs.rmdirSync(path.resolve(__dirname, 'dist/src'));
        console.log('✅ Cleaned up nested directories');
    } catch (e) {
        // Directories might not be empty or might not exist
    }
} else {
    console.log('❌ popup.html not found at expected location');
} 