const sharp = require('sharp');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="90" viewBox="0 0 80 90">
  <rect width="80" height="90" fill="#e5e7eb"/>
  <circle cx="40" cy="28" r="14" fill="#9ca3af"/>
  <ellipse cx="40" cy="72" rx="22" ry="18" fill="#9ca3af"/>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile('public/silhouette.png')
  .then(() => console.log('Created public/silhouette.png'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
