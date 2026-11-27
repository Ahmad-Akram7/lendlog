const {test,describe}=require('node:test');const assert=require('node:assert/strict');
const R=require('../lib/records');
const NOW='2026-01-01T00:00:00.000Z',TODAY='01/01/2026';let n=0;const id=()=>`id_${++n}`;
const rec=(o={})=>R.createLoanRecord({id:'r1',name:'Alice',amount:500,type:'lent',date:TODAY,now:NOW,...o});
describe('Production record logic',()=>{
test('round2 and create record',()=>{assert.equal(R.round2(.1+.2),.3);assert.equal(rec({name:'  A  '}).name,'A');assert.equal(rec({name:' '}).name,'Unknown');});
test('payments add and delete',()=>{let r=rec({amount:300});r=R.addPaymentToRecord(r,{id:'p1',amount:100,date:TODAY,note:''},NOW);r=R.addPaymentToRecord(r,{id:'p2',amount:200,date:TODAY,note:''},NOW);assert.equal(r.settled,true);r=R.deletePaymentFromRecord(r,'p2',NOW);assert.equal(r.paid_amount,100);assert.equal(r.settled,false);});
test('manual settlement is an explicit reversible ledger adjustment',()=>{let r=R.addPaymentToRecord(rec({amount:750}),{id:'p1',amount:250,date:TODAY,note:''},NOW);r=R.toggleSettlementRecord(r,TODAY,NOW,id);assert.equal(r.paid_amount,750);assert.equal(r.payments[1].kind,'settlement');r=R.toggleSettlementRecord(r,TODAY,NOW,id);assert.equal(r.paid_amount,250);assert.deepEqual(r.payments.map(p=>p.id),['p1']);});
test('settle all records for a person records adjustments',()=>{const rs=[rec({id:'1',name:'Grace',amount:200}),rec({id:'2',name:'grace',amount:300}),rec({id:'3',name:'Other'})];const out=R.settleRecordsForPerson(rs,'GRACE',TODAY,NOW,id);assert.equal(out[0].paid_amount,200);assert.equal(out[1].paid_amount,300);assert.equal(out[2].settled,false);});
test('summary and people calculations use production code',()=>{const rs=[rec({id:'1',amount:.1}),rec({id:'2',amount:.2}),rec({id:'3',name:'Bob',amount:.15,type:'borrowed'})];const s=R.calculateSummary(rs);assert.equal(s.totalLent,.3);assert.equal(s.totalBorrowed,.15);assert.equal(s.netBalance,.15);assert.equal(R.calculatePeopleStats(rs).length,2);});
test('restore sanitizer retains settlement adjustment metadata',()=>{const out=R.sanitizeRestoredRecords([{id:'r',name:'Kirk',amount:500,payments:[{id:'p',amount:'100',kind:'settlement'}]}],{today:TODAY,now:NOW,genId:id});assert.equal(out[0].paid_amount,100);assert.equal(out[0].payments[0].kind,'settlement');});
test('date parsing supports DD/MM/YYYY and ISO',()=>{assert.equal(R.parseRecordDate('19/10/2026').getMonth(),9);assert.equal(R.parseRecordDate('2026-10-19').getFullYear(),2026);assert.equal(R.parseRecordDate('bad'),null);});
});
