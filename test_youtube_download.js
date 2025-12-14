const youtubedl = require('youtube-dl-exec');
const path = require('path');

async function downloadMP3(videoUrl, outputDir = './downloads', browser = 'chrome') {
  try {
    console.log(`Starting download with cookies from ${browser}...`);
    
    const output = await youtubedl(videoUrl, {
      output: path.join(outputDir, '%(title)s.%(ext)s'),
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
      cookiesFromBrowser: browser, // Extract directly from browser
      noCheckCertificates: true,
      noWarnings: true,
      addMetadata: true,
      noPlaylist: true,
    });

    console.log('✓ Download complete!');
    return output;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Usage
const url = process.argv[2];
const browser = process.argv[3] || 'chrome'; // chrome, firefox, edge, brave, opera

if (!url) {
  console.log('Usage: node download-mp3.js "YOUTUBE_URL" [browser]');
  console.log('Browsers: chrome, firefox, edge, brave, opera');
  process.exit(1);
}

downloadMP3(url, './downloads', browser)
  .then(() => console.log('Done!'))
  .catch(err => console.error('Failed:', err));