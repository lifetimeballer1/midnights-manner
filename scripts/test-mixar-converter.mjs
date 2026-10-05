import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('offline Mixar converter preserves source geometry, color and winding',()=>{
 const result=spawnSync(process.env.PYTHON_BIN||'python',['-m','unittest','discover','-s','scripts/tests','-p','test_mixar_converter.py'],{encoding:'utf8'});
 assert.equal(result.status,0,result.error?.message||result.stdout+result.stderr);
});
