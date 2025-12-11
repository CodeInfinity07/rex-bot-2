const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const testUrl = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const outputDir = './test-songs';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Testing yt-dlp download...`);
console.log(`URL: ${testUrl}`);
console.log(`Output directory: ${outputDir}`);
console.log('');

const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

const args = [
    '--extractor-args', 'youtube:player_client=android',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputTemplate,
    '--no-playlist',
    testUrl
];

console.log(`Command: yt-dlp ${args.join(' ')}`);
console.log('');
console.log('Starting download...');
console.log('');

const ytdlp = spawn('yt-dlp', args);

ytdlp.stdout.on('data', (data) => {
    console.log(data.toString().trim());
});

ytdlp.stderr.on('data', (data) => {
    console.log(data.toString().trim());
});

ytdlp.on('error', (err) => {
    console.error('');
    console.error('yt-dlp not found! Install it with:');
    console.error('  pip install yt-dlp');
    console.error('');
    console.error('Error:', err.message);
});

ytdlp.on('close', (code) => {
    console.log('');
    if (code === 0) {
        console.log('Download complete!');
        const files = fs.readdirSync(outputDir);
        console.log('Files in output directory:');
        files.forEach(f => {
            const stats = fs.statSync(path.join(outputDir, f));
            console.log(`  - ${f} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        });
    } else {
        console.log(`yt-dlp exited with code ${code}`);
    }
});
