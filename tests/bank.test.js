import test from 'node:test';
import assert from 'node:assert/strict';
import {seed, transfer, totals} from '../src/bank.js';
test('transfer updates balance and bill once, retries are idempotent',()=>{
 const before=seed(), request={id:'test',contactId:'zhang',amount:30000};
 const after=transfer(before,request);
 assert.equal(after.balance,before.balance-30000);
 assert.equal(totals(after).spending,totals(before).spending+30000);
 assert.equal(transfer(after,request),after);
 assert.equal(before.transactions.length,8);
});
test('rejects invalid and unaffordable transfers without mutating account',()=>{
 const state=seed();
 for(const amount of [0,-1,1.2,NaN,state.balance+1]) assert.throws(()=>transfer(state,{id:'bad',contactId:'zhang',amount}));
 assert.throws(()=>transfer(state,{id:'bad',contactId:'unknown',amount:100}));
 assert.equal(state.balance,1286050);
});
test('ledger reconciles with opening balance',()=>{
 const state=seed();
 assert.equal(260250 + state.transactions.reduce((a,t)=>a+t.amount,0),state.balance);
 assert.equal(totals(state).spending,474200);
});
