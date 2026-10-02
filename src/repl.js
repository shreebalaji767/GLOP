import readline from "node:readline";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { compileBytecode } from "./bytecode-compiler.js";
import { VM } from "./vm.js";

export async function startRepl({input=process.stdin,output=process.stdout}={}) {
  const globals=new Map();
  const rl=readline.createInterface({input,output,prompt:"GLOP> "});
  let buffer="";
  let balance=0;
  console.log("GLOP 0.9.0 REPL — type .help for commands, .exit to leave.");
  rl.prompt();
  for await (const line of rl) {
    const trimmed=line.trim();
    if(!buffer&&trimmed===".exit"){rl.close();break}
    if(!buffer&&trimmed===".help"){console.log(".help  show commands\n.exit  leave the GLOP REPL\n.clear clear the current input buffer");rl.prompt();continue}
    if(!buffer&&trimmed===".clear"){buffer="";balance=0;rl.setPrompt("GLOP> ");rl.prompt();continue}
    buffer+=line+"\n";
    for(const ch of line){if(ch==="{")balance++;else if(ch==="}")balance--}
    if(balance>0){rl.setPrompt("... ");rl.prompt();continue}
    if(balance<0){console.error("GLOP REPL OOPSIE: unmatched }");buffer="";balance=0;rl.setPrompt("GLOP> ");rl.prompt();continue}
    try {
      const ast=parse(lex(buffer)); analyze(ast);
      const vm=new VM(compileBytecode(ast),{globals,output:value=>console.log(value)});
      vm.run();
    } catch(e) { console.error("GLOP OOPSIE: "+e.message); }
    buffer="";rl.setPrompt("GLOP> ");rl.prompt();
  }
}
