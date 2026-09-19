import test from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalHttpComparableProvider,CanonicalHttpEvidenceCaptureProvider} from './http-providers.js';
import {validateComparableEvidenceCapture} from './evidence-capture.js';

test('provider adapters reject insecure non-local production URLs',()=>{
  assert.throws(()=>new CanonicalHttpComparableProvider({name:'x',baseUrl:'http://example.com',token:'secret'}),/provider_url_invalid/);
  assert.throws(()=>new CanonicalHttpEvidenceCaptureProvider({name:'x',baseUrl:'http://example.com',token:'secret'}),/provider_url_invalid/);
});

test('provider adapters allow HTTPS and localhost development',()=>{
  assert.doesNotThrow(()=>new CanonicalHttpComparableProvider({name:'x',baseUrl:'https://provider.example.com',token:'secret'}));
  assert.doesNotThrow(()=>new CanonicalHttpEvidenceCaptureProvider({name:'x',baseUrl:'http://localhost:9000',token:'secret'}));
});

test('evidence capture requires immutable SHA-256 provenance',()=>{
  const valid=validateComparableEvidenceCapture({comparableId:'c1',sourceUrl:'https://dealer.example/car',capturedAt:new Date().toISOString(),contentType:'image/png',storageKey:'tenant/claim/c1.png',sha256:'a'.repeat(64),provider:'capture'});
  assert.equal(valid.comparableId,'c1');
  assert.throws(()=>validateComparableEvidenceCapture({...valid,sha256:'bad'}),/capture_sha256_invalid/);
});
