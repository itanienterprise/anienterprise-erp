const fs = require('fs');
const path = require('path');

const baseDir = '/Users/mdriyadahmed/Documents/ERP_ANI_Enterprise/client/src/components/modules';
const importerDir = path.join(baseDir, 'Importer');
const exporterDir = path.join(baseDir, 'Exporter');

fs.mkdirSync(exporterDir, { recursive: true });

// Process CSS
let css = fs.readFileSync(path.join(importerDir, 'Importer.css'), 'utf8');
css = css.replace(/Importer/g, 'Exporter').replace(/importer/g, 'exporter');
fs.writeFileSync(path.join(exporterDir, 'Exporter.css'), css);

// Process JSX
let jsx = fs.readFileSync(path.join(importerDir, 'Importer.jsx'), 'utf8');
jsx = jsx.replace(/Importer/g, 'Exporter').replace(/importer/g, 'exporter');
fs.writeFileSync(path.join(exporterDir, 'Exporter.jsx'), jsx);

console.log('Exporter files created successfully.');
