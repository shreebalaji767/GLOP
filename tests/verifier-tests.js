import assert from "node:assert/strict";
import { lex } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { compileBytecode } from "../src/bytecode-compiler.js";
import { verifyBytecode, GlopBytecodeError } from "../src/verifier.js";
import { OP } from "../src/bytecode.js";

const bc=compileBytecode(parse(lex("GLOP x = 10 YAP x")));
assert.equal(verifyBytecode(bc),true);
const bad=structuredClone(bc);
bad.code[0]={op:"NOPE_OPCODE",arg:null};
assert.throws(()=>verifyBytecode(bad),GlopBytecodeError);

const underflow=structuredClone(bc);
underflow.code[0]={op:OP.POP,arg:null};
assert.throws(()=>verifyBytecode(underflow),/underflow/);

const inconsistent={
  arity:0,name:"bad-flow",freeNames:[],localNames:{},constants:[true],
  functions:[],
  code:[
    {op:OP.CONST,arg:0},
    {op:OP.JUMP_IF_FALSE,arg:4},
    {op:OP.CONST,arg:0},
    {op:OP.JUMP,arg:5},
    {op:OP.CONST,arg:0},
    {op:OP.HALT,arg:null}
  ]
};
assert.throws(()=>verifyBytecode(inconsistent),/inconsistent stack heights/);

const validCatch={
  arity:0,name:"catch-flow",freeNames:[],localNames:{},constants:["boom",null],
  functions:[],
  code:[
    {op:OP.SETUP_CATCH,arg:4},
    {op:OP.CONST,arg:0},
    {op:OP.THROW,arg:null},
    {op:OP.JUMP,arg:5},
    {op:OP.POP,arg:null},
    {op:OP.CONST,arg:1},
    {op:OP.HALT,arg:null}
  ]
};
assert.equal(verifyBytecode(validCatch).maxStack,1);
console.log("GLOP BYTECODE VERIFIER TEST PASSED.");
