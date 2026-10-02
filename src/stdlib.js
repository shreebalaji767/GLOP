import fs from "node:fs";
import path from "node:path";

const need=(n,a)=>{if(a.length!==n)throw new Error("expected "+n+" argument(s), got "+a.length)};
const num=(x,name)=>{if(typeof x!=="number")throw new Error((name||"operation")+" expects a number");return x};
const str=(x,name)=>{if(typeof x!=="string")throw new Error((name||"operation")+" expects a string");return x};
export const GLOP_STDLIB=Object.freeze({
  LEN(a){need(1,a);if(a[0]==null)throw new Error("LEN cannot inspect VOID");return a[0].length??Object.keys(a[0]).length},
  PUSH(a){need(2,a);if(!Array.isArray(a[0]))throw new Error("PUSH expects an array");a[0].push(a[1]);return a[0].length},
  POP(a){need(1,a);if(!Array.isArray(a[0]))throw new Error("POP expects an array");return a[0].pop()??null},
  TYPE(a){need(1,a);const x=a[0];if(x===null)return "null";if(Array.isArray(x))return "array";if(typeof x==="function")return "function";return typeof x==="object"?"object":typeof x},
  TO_STRING(a){need(1,a);return String(a[0])},
  ABS(a){need(1,a);return Math.abs(num(a[0],"ABS"))}, SQRT(a){need(1,a);return Math.sqrt(num(a[0],"SQRT"))},
  FLOOR(a){need(1,a);return Math.floor(num(a[0],"FLOOR"))}, CEIL(a){need(1,a);return Math.ceil(num(a[0],"CEIL"))},
  SUBSTR(a){need(3,a);return str(a[0],"SUBSTR").slice(num(a[1],"SUBSTR"),num(a[1],"SUBSTR")+num(a[2],"SUBSTR"))},
  UPPER(a){need(1,a);return str(a[0],"UPPER").toUpperCase()}, LOWER(a){need(1,a);return str(a[0],"LOWER").toLowerCase()},
  HAS(a){need(2,a);const x=a[0],k=a[1];if(Array.isArray(x))return typeof k==="number"&&k>=0&&k<x.length;if(typeof x==="string")return x.includes(str(k,"HAS"));return x!=null&&Object.prototype.hasOwnProperty.call(x,k)},
  KEYS(a){need(1,a);if(a[0]==null||typeof a[0]!=="object")throw new Error("KEYS expects an object");return Object.keys(a[0])},
  RANGE(a){if(a.length<1||a.length>3)throw new Error("RANGE expects 1 to 3 arguments");let s=0,e=num(a[a.length===1?0:1],"RANGE"),step=1;if(a.length>1){s=num(a[0],"RANGE");if(a.length===3)step=num(a[2],"RANGE")}if(step===0)throw new Error("RANGE step cannot be zero");const out=[];for(let x=s;step>0?x<e:x>e;x+=step)out.push(x);return out},
  NUMBER(a){need(1,a);if(typeof a[0]==="number")return a[0];const x=Number(str(a[0],"NUMBER"));if(Number.isNaN(x))throw new Error("NUMBER could not parse value");return x},
  MIN(a){if(!a.length)throw new Error("MIN expects at least 1 argument");return Math.min(...a.map(x=>num(x,"MIN")))},
  MAX(a){if(!a.length)throw new Error("MAX expects at least 1 argument");return Math.max(...a.map(x=>num(x,"MAX")))},
  POW(a){need(2,a);return Math.pow(num(a[0],"POW"),num(a[1],"POW"))},
  CLAMP(a){need(3,a);const x=num(a[0],"CLAMP"),lo=num(a[1],"CLAMP"),hi=num(a[2],"CLAMP");if(lo>hi)throw new Error("CLAMP minimum cannot exceed maximum");return Math.max(lo,Math.min(x,hi))},
  ASSERT(a){if(!a.length||a.length>2)throw new Error("ASSERT expects 1 or 2 arguments");if(!a[0])throw new Error(a[1]==null?"ASSERT failed":String(a[1]));return true},
  REPEAT(a){need(2,a);const n=num(a[1],"REPEAT");if(n<0||!Number.isInteger(n))throw new Error("REPEAT count must be a non-negative integer");return str(a[0],"REPEAT").repeat(n)},
  TRIM(a){need(1,a);return str(a[0],"TRIM").trim()},
  REPLACE(a){need(3,a);return str(a[0],"REPLACE").split(str(a[1],"REPLACE")).join(str(a[2],"REPLACE"))},
  SPLIT(a){need(2,a);return str(a[0],"SPLIT").split(str(a[1],"SPLIT"))},
  JOIN(a){need(2,a);if(!Array.isArray(a[0]))throw new Error("JOIN expects an array");return a[0].map(String).join(str(a[1],"JOIN"))},
  READ_FILE(a){need(1,a);return fs.readFileSync(str(a[0],"READ_FILE"),"utf8")},
  WRITE_FILE(a){need(2,a);fs.writeFileSync(str(a[0],"WRITE_FILE"),str(a[1],"WRITE_FILE"));return true},
  EXISTS(a){need(1,a);return fs.existsSync(str(a[0],"EXISTS"))},
  CWD(a){need(0,a);return process.cwd()},
  JOIN_PATH(a){if(!a.length)throw new Error("JOIN_PATH expects at least 1 argument");return path.join(...a.map(x=>str(x,"JOIN_PATH")))},
  ENV(a){need(1,a);return process.env[str(a[0],"ENV")]??null},
  ARGS(a){need(0,a);return process.argv.slice(2)},
  TIME_MS(a){need(0,a);return Date.now()},
  SLEEP_MS(a){need(1,a);const ms=num(a[0],"SLEEP_MS");const end=Date.now()+ms;while(Date.now()<end){}return null}
});
