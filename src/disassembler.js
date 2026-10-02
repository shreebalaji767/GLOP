import { OP } from "./bytecode.js";

export function disassembleChunk(chunk, indent=0){
  const pad=" ".repeat(indent), lines=[];
  lines.push(pad+"FUNCTION "+(chunk.name||"<main>")+" arity="+(chunk.arity||0));
  if(chunk.freeNames?.length) lines.push(pad+"  FREE "+chunk.freeNames.join(", "));
  const locals=Object.entries(chunk.localNames||{}).sort((a,b)=>Number(a[1])-Number(b[1]));
  if(locals.length) lines.push(pad+"  LOCALS "+locals.map(([n,i])=>i+"="+n).join(", "));
  if(chunk.constants?.length){lines.push(pad+"  CONSTANTS");chunk.constants.forEach((v,i)=>lines.push(pad+"    ["+i+"] "+JSON.stringify(v)));}
  lines.push(pad+"  CODE");
  chunk.code.forEach((ins,i)=>{const a=ins.arg==null?"":String(ins.arg);lines.push(pad+"    "+String(i).padStart(4,"0")+"  "+ins.op.padEnd(16," ")+a);});
  for(const fn of chunk.functions||[]) lines.push(disassembleChunk(fn,indent+2));
  return lines.join("\n");
}
export const disassemble=disassembleChunk;