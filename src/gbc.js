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
  w.u32((c.freeNames??[]).length);for(const n of (c.freeNames??[]))w.string(n);
  const localNames=Object.entries(c.localNames??{});w.u32(localNames.length);for(const [name,index] of localNames){w.u32(Number(index));w.string(name);}
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
  const w=new Writer();w.parts.push(Buffer.from("GBC2"));w.u8(2);writeChunk(w,bytecode);return w.result();
};

export const writeGBC=(bytecode,file)=>fs.writeFileSync(file,encodeGBC(bytecode));


class Reader{
  constructor(buffer){this.b=buffer;this.o=0}
  need(n){if(this.o+n>this.b.length)throw new Error("GBC OOPSIE: truncated bytecode")}
  u8(){this.need(1);return this.b[this.o++]}
  u32(){this.need(4);const v=this.b.readUInt32LE(this.o);this.o+=4;return v}
  i32(){this.need(4);const v=this.b.readInt32LE(this.o);this.o+=4;return v}
  f64(){this.need(8);const v=this.b.readDoubleLE(this.o);this.o+=8;return v}
  string(){const n=this.u32();this.need(n);const s=this.b.subarray(this.o,this.o+n).toString("utf8");this.o+=n;return s}
}

const readValue=r=>{
  switch(r.u8()){
    case 0:return null;
    case 1:return false;
    case 2:return true;
    case 3:return r.f64();
    case 4:return r.string();
    default:throw new Error("GBC OOPSIE: invalid constant tag");
  }
};

const readArg=r=>{
  const type=r.u8();
  if(type===0)return null;
  if(type===1)return r.i32();
  if(type===2)return r.string();
  throw new Error("GBC OOPSIE: invalid instruction argument tag");
};

const readChunk=r=>{
  const arity=r.u32(),name=r.string();
  const freeCount=r.u32(),freeNames=[];for(let i=0;i<freeCount;i++)freeNames.push(r.string());
  const localCount=r.u32(),localNames={};
  for(let i=0;i<localCount;i++){const index=r.u32();const localName=r.string();localNames[localName]=index;}
  const constantCount=r.u32(),constants=[];for(let i=0;i<constantCount;i++)constants.push(readValue(r));
  const functionCount=r.u32(),functions=[];for(let i=0;i<functionCount;i++)functions.push(readChunk(r));
  const codeCount=r.u32(),code=[];
  for(let i=0;i<codeCount;i++){
    const oi=r.u8();
    if(oi>=OPS.length)throw new Error("GBC OOPSIE: unknown opcode index "+oi);
    code.push({op:OPS[oi],arg:readArg(r)});
  }
  return {arity,name,freeNames,localNames,constants,functions,code};
};

export const decodeGBC=buffer=>{
  const b=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
  if(b.subarray(0,4).toString("ascii")!=="GBC2")throw new Error("GBC OOPSIE: unsupported or corrupt magic");
  if(b[4]!==2)throw new Error("GBC OOPSIE: unsupported GBC2 version "+b[4]);
  const r=new Reader(b);r.o=5;
  const chunk=readChunk(r);
  if(r.o!==b.length)throw new Error("GBC OOPSIE: trailing bytes after program");
  return chunk;
};

export const readGBC=file=>decodeGBC(fs.readFileSync(file));
