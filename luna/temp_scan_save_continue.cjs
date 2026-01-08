const fs=require('fs');
const path=require('path');
const files=fs.readdirSync('src/pages').filter(f=>f.endsWith('.jsx'));
for(const file of files){
  const text=fs.readFileSync(path.join('src/pages',file),'utf8');
  const regex=/\<button([^>]*?)>\s*Save\s*&\s*Continue\s*<\/button>/g;
  let match;
  while((match=regex.exec(text))){
    const lines=text.slice(0,match.index).split(/\r?\n/);
    console.log(file+':'+lines.length+': '+match[0].replace(/\s+/g,' '));
  }
}
