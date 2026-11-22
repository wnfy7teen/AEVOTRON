#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT=process.cwd();
const LANGUAGES=["en","ru","zh"];
const NAMESPACES=["translation","dashboard","landing","auth"];
const FILES={
  translation:(l)=>path.join(ROOT,"src/locales/"+l+".json"),
  dashboard:(l)=>path.join(ROOT,"src/locales/dashboard/"+l+".json"),
  landing:(l)=>path.join(ROOT,"src/locales/landing/"+l+".json"),
  auth:(l)=>path.join(ROOT,"src/locales/auth/"+l+".json"),
};
const FIX=process.argv.includes("--fix");
const PLACEHOLDER=/^(?:\.{3,}|…+|TODO(?:\s*:.*)?|FIXME(?:\s*:.*)?|UNTRANSLATED(?:\s*:.*)?|TRANSLATION MISSING|PLACEHOLDER|\[TODO\])$/i;
const INTERPOLATION=/\{\{\s*([\w.-]+)(?:\s*,[^}]*)?\s*\}\}/g;
const report={
  generatedAt:new Date().toISOString(),mode:FIX?"fix":"check",
  languages:LANGUAGES,namespaces:{},scannedSourceFiles:0,scannedLiteralKeys:0,
  dynamicTranslationCalls:[],placeholderMatches:[],addedKeys:[],fallbackApplied:[],repairedPlaceholders:[],
  interpolationRepairs:[],unresolved:[],errors:[],summary:{}
};

const usable=(v)=>typeof v==="string"&&v.trim().length>0&&!PLACEHOLDER.test(v.trim());
const vars=(v)=>[...String(v).matchAll(INTERPOLATION)].map(m=>m[1]).sort();
const sameVars=(a,b)=>JSON.stringify(vars(a))===JSON.stringify(vars(b));
const humanKey=(k)=>/^[A-Za-z][A-Za-z0-9 _'’&!?.,:;()\/+-]*$/.test(k)&&k.trim().length>0;
const rel=(p)=>path.relative(ROOT,p);

async function readCatalog(ns,lang){
  const file=FILES[ns](lang);
  try{
    const data=JSON.parse(await readFile(file,"utf8"));
    if(!data||Array.isArray(data)||typeof data!=="object")throw new Error("Expected a flat JSON object");
    for(const [key,value] of Object.entries(data)){
      if(typeof value!=="string")report.errors.push({type:"non_string_value",namespace:ns,language:lang,key});
    }
    return data;
  }catch(error){
    report.errors.push({type:"catalog_read_error",namespace:ns,language:lang,file:rel(file),message:error.message});
    return {};
  }
}

async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name==="locales"||entry.name==="node_modules"||entry.name.startsWith("."))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));
    else if(/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)&&!entry.name.endsWith(".d.ts"))out.push(full);
  }
  return out;
}

async function collectKeys(){
  const found=Object.fromEntries(NAMESPACES.map(ns=>[ns,new Map()]));
  const files=await walk(path.join(ROOT,"src"));
  const patterns=[
    {q:'"',re:/\bt\(\s*"((?:\\.|[^"\\])*)"/g},
    {q:"'",re:/\bt\(\s*'((?:\\.|[^'\\])*)'/g}
  ];
  for(const file of files){
    const source=await readFile(file,"utf8");
    const nsMatch=source.match(/\b(?:useTranslation|useLanguage)\s*\(\s*(?:\[\s*["'](dashboard|landing|auth)["']|["'](dashboard|landing|auth)["'])/);
    const ns=nsMatch?(nsMatch[1]||nsMatch[2]):"translation";
    let count=0;
    for(const p of patterns){
      for(const match of source.matchAll(p.re)){
        let key=match[1];
        try{if(p.q==='"')key=JSON.parse('"'+key+'"');else key=key.replace(/\\(['"\\])/g,"$1");}catch{}
        if(!key||!key.trim())continue;
        count++;
        if(!found[ns].has(key))found[ns].set(key,{file:rel(file),line:source.slice(0,match.index).split("\n").length});
      }
    }
    for(const match of source.matchAll(/\bt\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*[,)]/g)){
      report.dynamicTranslationCalls.push({file:rel(file),line:source.slice(0,match.index).split("\n").length,expression:match[1]});
    }
    report.scannedSourceFiles++;
    report.scannedLiteralKeys+=count;
  }
  return found;
}

async function main(){
  const catalogs={};
  for(const ns of NAMESPACES){
    catalogs[ns]={};
    for(const lang of LANGUAGES)catalogs[ns][lang]=await readCatalog(ns,lang);
  }
  const sourceKeys=await collectKeys();

  const sourceKeysToAdd={};
  for(const ns of NAMESPACES){
    sourceKeysToAdd[ns]=new Map([...sourceKeys[ns]].filter(([key]) =>
      ns==="translation" || !LANGUAGES.some(l=>Object.hasOwn(catalogs.translation[l],key))
    ));
    for(const [key,location] of sourceKeysToAdd[ns]){
      const inDomain=LANGUAGES.some(l=>Object.hasOwn(catalogs[ns][l],key));
      if(!inDomain&&!humanKey(key)){
        report.unresolved.push({namespace:ns,key,reason:"Missing source key is not readable English; automatic fallback is unsafe.",...location});
      }
    }
  }

  for(const ns of NAMESPACES){
    for(const lang of LANGUAGES){
      for(const [key,value] of Object.entries(catalogs[ns][lang])){
        if(typeof value!=="string")continue;
        const matches=[...value.matchAll(/(?:\\.{3,}|…+|\\bTODO\\b|\\bFIXME\\b|\\bUntranslated\\b)/gi)];
        for(const match of matches)report.placeholderMatches.push({
          namespace:ns,language:lang,key,match:match[0],value
        });
      }
    }
  }

  const writes=[];
  for(const ns of NAMESPACES){
    const before=Object.fromEntries(LANGUAGES.map(l=>[l,JSON.stringify(catalogs[ns][l],null,2)+"\n"]));
    const keys=new Set(LANGUAGES.flatMap(l=>Object.keys(catalogs[ns][l])));
    for(const key of sourceKeysToAdd[ns].keys())keys.add(key);
    const nsReport={keyCount:keys.size,added:[],fallback:[],placeholders:[],interpolation:[],unresolved:[]};

    for(const key of [...keys].sort()){
      const original=Object.fromEntries(LANGUAGES.map(l=>[l,catalogs[ns][l][key]]));
      let sourceLang=usable(original.en)?"en":usable(original.ru)?"ru":null;
      let sourceText=sourceLang?original[sourceLang]:null;
      const location=sourceKeysToAdd[ns].get(key);

      if(!sourceText&&location&&humanKey(key)){
        sourceLang="en";sourceText=key;
        catalogs[ns].en[key]=key;
        const item={namespace:ns,key,language:"en",source:"literal UI text",...location};
        report.addedKeys.push(item);nsReport.added.push(item);
      }
      if(!sourceText){
        const item={namespace:ns,key,reason:"No usable English or Russian source text exists; automatic fallback is unsafe.",available:LANGUAGES.filter(l=>usable(original[l])),...(location||{})};
        report.unresolved.push(item);nsReport.unresolved.push(item);continue;
      }

      for(const lang of LANGUAGES){
        const current=catalogs[ns][lang][key];
        if(usable(current))continue;
        catalogs[ns][lang][key]=sourceText;
        const item={
          namespace:ns,key,language:lang,fallbackFrom:sourceLang,fallbackText:sourceText,
          reason:current===undefined?"missing_key":(typeof current!=="string"||!current.trim()?"empty_value":"placeholder"),
          ...(location||{})
        };
        report.fallbackApplied.push(item);nsReport.fallback.push(item);
        if(current===undefined){report.addedKeys.push(item);nsReport.added.push(item);}
        else{report.repairedPlaceholders.push(item);nsReport.placeholders.push(item);}
      }

      const canonical=usable(catalogs[ns].en[key])?catalogs[ns].en[key]:catalogs[ns].ru[key];
      for(const lang of ["ru","zh"]){
        if(!sameVars(catalogs[ns][lang][key],canonical)){
          const item={namespace:ns,key,language:lang,reason:"interpolation_variables_mismatch",fallbackFrom:"en"};
          catalogs[ns][lang][key]=canonical;
          report.interpolationRepairs.push(item);report.fallbackApplied.push({...item,fallbackText:canonical});
          nsReport.interpolation.push(item);
        }
      }
    }
    report.namespaces[ns]=nsReport;
    for(const lang of LANGUAGES){
      const after=JSON.stringify(catalogs[ns][lang],null,2)+"\n";
      if(after!==before[lang])writes.push({namespace:ns,language:lang,file:FILES[ns](lang),content:after});
    }
  }

  if(FIX)for(const item of writes)await writeFile(item.file,item.content,"utf8");
  report.summary={
    namespaces:NAMESPACES.length,scannedSourceFiles:report.scannedSourceFiles,
    scannedLiteralKeys:report.scannedLiteralKeys,dynamicTranslationCalls:report.dynamicTranslationCalls.length,placeholderMatches:report.placeholderMatches.length,
    filesToUpdate:writes.length,filesUpdated:FIX?writes.length:0,keysAdded:report.addedKeys.length,
    fallbacksApplied:report.fallbackApplied.length,placeholdersRepaired:report.repairedPlaceholders.length,
    interpolationRepairs:report.interpolationRepairs.length,unresolved:report.unresolved.length,errors:report.errors.length
  };
  await writeFile(path.join(ROOT,"i18n-report.json"),JSON.stringify(report,null,2)+"\n","utf8");

  console.log("\nAEVOTRON i18n "+(FIX?"AUTO-FIX":"CHECK"));
  for(const [key,value] of Object.entries(report.summary))console.log(key+": "+value);
  console.log("Report: i18n-report.json");
  if(report.placeholderMatches.length){
    console.warn("\\nPlaceholder scan matches (review; not all ellipses are errors):");
    for(const item of report.placeholderMatches)console.warn(" - ["+item.namespace+"/"+item.language+"] "+item.key+" contains "+JSON.stringify(item.match));
  }
  if(report.unresolved.length){
    console.error("\nCRITICAL: automatic fallback is impossible:");
    for(const item of report.unresolved)console.error(" - ["+item.namespace+"] "+item.key+" — "+item.reason);
  }
  if(report.errors.length){
    console.error("\nCatalog errors:");
    for(const item of report.errors)console.error(" - "+JSON.stringify(item));
  }
  if(report.unresolved.length||report.errors.length)process.exitCode=1;
  else if(!FIX&&writes.length){
    console.error("\nSafe automatic repairs are available. Run: npm run i18n:fix");
    process.exitCode=1;
  }else console.log(FIX?"\nAutomatic repair completed.":"\nAll locale catalogs and literal UI keys are valid.");
}

main().catch(error=>{console.error("i18n checker failed:",error);process.exitCode=1;});
