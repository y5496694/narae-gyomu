import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {WxsCapture} from '../src/wxs-capture.mjs';

test('WXS bridge waits for native ready, keeps one reader and preserves authentication results',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wxs-bridge-'));let child,args;
 const capture=new WxsCapture({python:'synthetic-python',entry:'original-wxs-cli.py',directory,spawnReader:(_exe,argv)=>{args=argv;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};setImmediate(()=>{child.stdout.write('{"ready":');child.stdout.write('true}\n');});return child;}});
 try{const ready=await capture.prepare('합성 공문 제목');assert(ready.ready);assert(args.includes('read-next'));assert(args.includes('--attachments-dir'));assert(args.includes('--background'));assert.equal(capture.result(ready.id).pending,true);await assert.rejects(capture.prepare('다른 문서'),/진행 중/);const job=capture.jobs.get(ready.id);fs.writeFileSync(job.output,JSON.stringify({status:'authentication_required',closed:false,preserved:true,body:{body_read:false}}));child.emit('exit',2);const result=capture.result(ready.id);assert.equal(result.exit_code,2);assert.equal(result.document.preserved,true);assert.equal(result.document.closed,false);assert.throws(()=>capture.result('invented'),/현재 세션/);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('WXS bridge never reports readiness after a failed original reader',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wxs-failure-'));
 const capture=new WxsCapture({python:'synthetic-python',entry:'original-wxs-cli.py',directory,spawnReader:()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};setImmediate(()=>child.emit('exit',1));return child;}});
 try{await assert.rejects(capture.prepare('합성 문서'),/문서를 열지/);assert.equal([...capture.jobs.values()][0].done,true);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
