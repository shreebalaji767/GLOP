import fs from "node:fs";
import { OP } from "./bytecode.js";

const OPS=Object.values(OP);
const opcodeIndex=new Map(OPS.map((name,i)=>[name,i]));

class Writer{
  constructor(){this.parts=[]}
  u8(v){this.parts.push(Buffer.from([v&255]))}
  u32(v){const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);this.parts.push(b)}
  i32(v){const b=Buffer.alloc(4);b.writeInt32LE(v|0);this.parts.push(b)}
  f64(v){const b=Buffer.alloc(8);b.writeDoubleLE(v);this.parts.push(b)}
  bytes(b){this.u32(b.length);this.parts.push(b)}
  string(s){this.bytes(Buffer.from(s,"utf8"))}
  result(){return Buffer.concat(this.parts)}
}

const writeValue=(w,v)=>{
  if(v===null){w.u8(0);return}
  if(v===false){w.u8(1);return}
  if(v===true){w.u8(2);return}
  if(typeof v==="number"){w.u8(3);w.f64(v);return}
  if(typeof v==="string"){w.u8(4);w.string(v);return}
  throw new Error("Native GBC serializer only supports null, booleans, numbers and strings in constants");
};

const writeArg=(w,arg)=>{
  if(arg===null||arg===undefined){w.u8(0);return}
  if(typeof arg==="number"){w.u8(1);w.i32(arg);return}
  if(typeof arg==="string"){w.u8(2);w.string(arg);return}
  throw new Error("Unsupported bytecode argument: "+typeof arg);
};

const writeChunk=(w,c)=>{
  w.u32(c.arity??0);w.string(c.name??"<main>");
  w.u32(c.constants.length);for(const v of c.constants)writeValue(w,v);
  w.u32(c.functions.length);for(const fn of c.functions)writeChunk(w,fn);
  w.u32(c.code.length);
  for(const ins of c.code){
    const oi=opcodeIndex.get(ins.op);
    if(oi===undefined)throw new Error("Unknown opcode: "+ins.op);
    w.u8(oi);writeArg(w,ins.arg);
  }
};

export const encodeGBC=bytecode=>{
  const w=new Writer();w.parts.push(Buffer.from("GBC1"));w.u8(1);writeChunk(w,bytecode);return w.result();
};

export const writeGBC=(bytecode,file)=>fs.writeFileSync(file,encodeGBC(bytecode));
