// Deterministic visual choreography contracts. Run with node --experimental-default-type=module.
import assert from 'node:assert/strict';
import {BASE_POINTS,routeFor,runnerPlans} from './field-animation.js';
assert.equal(BASE_POINTS.length,4);
assert.deepEqual(routeFor(0,4),[...BASE_POINTS,BASE_POINTS[0]]);
assert.deepEqual(routeFor(1,2),[BASE_POINTS[1],BASE_POINTS[2],BASE_POINTS[3]]);
assert.deepEqual(runnerPlans([false,false,false],'home_run').map(p=>[p.from,p.steps]),[[0,4]]);
assert.deepEqual(runnerPlans([true,true,true],'home_run').map(p=>[p.from,p.steps]),[[3,1],[2,2],[1,3],[0,4]]);
assert.deepEqual(runnerPlans([true,false,false],'single').map(p=>[p.from,p.steps]),[[1,1],[0,1]]);
assert.deepEqual(runnerPlans([true,true,true],'walk').map(p=>[p.from,p.steps]),[[3,1],[2,1],[1,1],[0,1]]);
assert.equal(runnerPlans([true,false,false],'strikeout').length,0);
assert.equal(runnerPlans([true,false,false],'groundout').length,0);
console.log('PASS base paths, single, grand slam, forced walk, strikeout, groundout');
