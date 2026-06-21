const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir);
}

const modelPath = path.join(modelsDir, 'llama-8b.gguf');
// Using Llama 3.1 8B Instruct (approx 4.9GB)
const url = 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';

console.log(`Downloading model to ${modelPath}...`);
console.log('This is a 4.9GB file and will take several minutes depending on your internet connection.');

const file = fs.createWriteStream(modelPath);

https.get(url, (response) => {
  if (response.statusCode === 301 || response.statusCode === 302) {
    // Follow redirect
    https.get(response.headers.location, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Download complete! You can now restart your server.');
      });
    }).on('error', (err) => {
      fs.unlinkSync(modelPath);
      console.error('Error downloading:', err.message);
    });
  } else {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Download complete! You can now restart your server.');
    });
  }
}).on('error', (err) => {
  fs.unlinkSync(modelPath);
  console.error('Error downloading:', err.message);
});
