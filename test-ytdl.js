const { Downloader } = require('ytdl-mp3');
const path = require('path');
const fs = require('fs');

const testUrl = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const outputDir = './test-songs';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Testing ytdl-mp3 download...`);
console.log(`URL: ${testUrl}`);
console.log(`Output directory: ${outputDir}`);
console.log('');

async function testDownload() {
    try {
        const downloader = new Downloader({
            getTags: false,
            outputDir: outputDir
        });

        console.log('Starting download...');
        const downloadedPath = await downloader.downloadSong(testUrl);
        
        console.log('');
        console.log('Download complete!');
        console.log(`File saved to: ${downloadedPath}`);
        
        const stats = fs.statSync(downloadedPath);
        console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
    } catch (error) {
        console.error('Download failed:', error.message);
        console.error(error);
    }
}

testDownload();
