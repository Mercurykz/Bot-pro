const fs = require('fs');
const filePath = 'c:\\Users\\Administrador\\Downloads\\Bot-pro\\Bot-pro\\Server\\server.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace both occurrences of class="btn-export-all" with class="btn btn-export-all"
content = content.replace('class="btn-export-all"', 'class="btn btn-export-all"');
content = content.replace('class="btn-export-all"', 'class="btn btn-export-all"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added .btn class to both export-all buttons!');
