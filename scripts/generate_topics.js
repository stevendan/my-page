const fs = require('fs');
const path = require('path');
const inPath = path.join(__dirname, '..', 'vocabulary.csv');
const outPath = path.join(__dirname, '..', 'topic.csv');
const txt = fs.readFileSync(inPath, 'utf8');
const lines = txt.replace(/\r/g,'').split('\n').filter(l=>l.trim());
lines.shift();
const topics = [];
const seen = new Set();
function parseFirstField(line){
  if(!line) return '';
  if(line[0] === '"'){
    let i = 1; let cur = '';
    while(i < line.length){
      if(line[i] === '"'){
        if(line[i+1] === '"') { cur += '"'; i += 2; continue; }
        else { i++; break; }
      } else { cur += line[i]; i++; }
    }
    return cur;
  } else {
    const idx = line.indexOf(',');
    return idx === -1 ? line : line.slice(0, idx);
  }
}
for(const l of lines){
  const t = parseFirstField(l).trim();
  if(t && !seen.has(t)) { seen.add(t); topics.push(t); }
}
const out = 'topic\n' + topics.map(t=> '"' + t.replace(/"/g,'""') + '"').join('\n') + '\n';
fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath, 'with', topics.length, 'topics');
