const fs=require('fs');
const path=require('path');
function scan(dir){
  for(const name of fs.readdirSync(dir)){
    const p=path.join(dir,name);
    if(fs.statSync(p).isDirectory()){
      scan(p);
    }else if(p.endsWith('.jsx')){
      const text=fs.readFileSync(p,'utf8');
      const regex=/<button[^>]*className="([^"]*)"[^>]*>/g;
      let match;
      while((match=regex.exec(text))){
        console.log(p+': '+match[1]);
      }
    }
  }
}
scan('src');
