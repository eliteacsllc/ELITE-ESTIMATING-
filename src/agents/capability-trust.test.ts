import test from 'node:test';
import assert from 'node:assert/strict';
import {gateEstimatingAction} from './capability-trust.js';
test('low trust cannot mutate estimate',()=>assert.equal(gateEstimatingAction({trust:{score:.7,verified:true,blocked:false,level:'sandbox'}}).allowed,false));
test('safety critical action still needs human approval',()=>assert.equal(gateEstimatingAction({trust:{score:.99,verified:true,blocked:false,level:'production_autonomous'},safetyCritical:true,humanApproved:false}).allowed,false));
test('high trust noncritical action may proceed',()=>assert.equal(gateEstimatingAction({trust:{score:.92,verified:true,blocked:false,level:'high_trust'}}).allowed,true));
