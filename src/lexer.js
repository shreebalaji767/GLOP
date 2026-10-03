export class GlopSyntaxError extends Error{constructor(message,line,column){super(`${message} at ${line}:${column}`);this.name="GlopSyntaxError";}}
const keywords=new Set(["GLOP","YAP","SUS","NAH","SPIN","WIZARD","YEET","BASED","CAP","VOID","OOPSIE","TRY","CATCH","NOPE","ZOOM","STEAL","FLEX","NEW","THIS"]);
export function lex(source){
 const tokens=[];let i=0,line=1,column=1;
 const builtinNames=new Set(["LEN","PUSH","POP","TYPE","TO_STRING","ABS","SQRT","FLOOR","CEIL","SUBSTR","UPPER","LOWER","HAS","KEYS","RANGE","NUMBER","MIN","MAX","POW","CLAMP","ASSERT","REPEAT","TRIM","REPLACE","SPLIT","JOIN","READ_FILE","WRITE_FILE","EXISTS","CWD","JOIN_PATH","ENV","ARGS","TIME_MS","SLEEP_MS","INSTANCEOF"]);
 const add=(type,value,l=line,c=column)=>tokens.push({type,value,line:l,column:c});
 const adv=()=>{const ch=source[i++];if(ch==="\n"){line++;column=1}else column++;return ch};
 while(i<source.length){
  const ch=source[i];
  if(/[ \\t\\r]/.test(ch)){adv();continue} if(ch==="\n"){adv();continue}
  if(ch==="/"&&source[i+1]==="/"){while(i<source.length&&source[i]!=="\n")adv();continue}
  if(ch==="/"&&source[i+1]==="*"){const sl=line,sc=column;adv();adv();let closed=false;while(i<source.length){if(source[i]==="*"&&source[i+1]==="/"){adv();adv();closed=true;break}adv()}if(!closed)throw new GlopSyntaxError("Unterminated block comment",sl,sc);continue}
  const l=line,c=column;
  if(/[A-Za-z_]/.test(ch)){let s="";while(i<source.length&&/[A-Za-z0-9_]/.test(source[i]))s+=adv();add(keywords.has(s)&&!builtinNames.has(s)?"keyword":"identifier",s,l,c);continue}
  if(/[0-9]/.test(ch)){let s="";while(i<source.length&&/[0-9]/.test(source[i]))s+=adv();if(source[i]==="."&&/[0-9]/.test(source[i+1]||"")){s+=adv();while(i<source.length&&/[0-9]/.test(source[i]))s+=adv()}if(source[i]==="e"||source[i]==="E"){s+=adv();if(source[i]==="+"||source[i]==="-")s+=adv();if(!/[0-9]/.test(source[i]||""))throw new GlopSyntaxError("Invalid numeric exponent",l,c);while(i<source.length&&/[0-9]/.test(source[i]))s+=adv()}add("number",Number(s),l,c);continue}
    if(ch==="«"||ch==='"'||ch==="'"){const q=adv(),end=q==="«"?"»":q;let s="";while(i<source.length&&source[i]!==end){if(source[i]==="\\"){adv();s+=adv()}else s+=adv()}if(source[i]!==end)throw new GlopSyntaxError("Unterminated string",l,c);adv();add("string",s,l,c);continue}
  const two=source.slice(i,i+2);if(["==","!=","<=",">=","&&","||","+=","-=","*=","/="].includes(two)){adv();adv();add("operator",two,l,c);continue}
  if("+-*/%<>=!".includes(ch)){adv();add("operator",ch,l,c);continue}
  if("(){}[],.;:".includes(ch)){adv();add("punct",ch,l,c);continue}
  throw new GlopSyntaxError(`Unexpected character ${JSON.stringify(ch)}`,l,c)
 }
 add("eof","",line,column);return tokens;
}