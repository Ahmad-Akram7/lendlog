const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
function parseRecordDate(s) {
  if (!s) return null;
  const p=s.split('/');
  if(p.length===3){const d=Number(p[0]),m=Number(p[1])-1,y=Number(p[2]);if(!Number.isNaN(d)&&!Number.isNaN(m)&&!Number.isNaN(y))return new Date(y,m,d);}
  const d=new Date(s); return Number.isNaN(d.getTime())?null:d;
}
function createLoanRecord({id,name,amount,type,note='',date,dueDate='',now=new Date().toISOString()}) {
  return {id,type,name:name.trim()||'Unknown',amount:round2(Math.max(0,amount)),paid_amount:0,note,date,due_date:dueDate,settled:false,settled_date:'',payments:[],created:now,updated:now};
}
function addPaymentToRecord(r,p,now) {
  const paid_amount=round2(r.paid_amount+p.amount), settled=paid_amount>=r.amount;
  return {...r,paid_amount,payments:[...r.payments,p],settled:settled?true:r.settled,settled_date:settled&&!r.settled?p.date:r.settled_date,updated:now};
}
function deletePaymentFromRecord(r,id,now) {
  const payments=r.payments.filter(p=>p.id!==id),paid_amount=round2(payments.reduce((s,p)=>s+p.amount,0)),settled=paid_amount>=r.amount&&r.amount>0;
  return {...r,payments,paid_amount,settled,settled_date:settled?r.settled_date:'',updated:now};
}
function toggleSettlementRecord(r,today,now,genId) {
  const settling=!r.settled, base=settling?r.payments:r.payments.filter(p=>p.kind!=='settlement');
  const paid=round2(base.reduce((s,p)=>s+p.amount,0)),delta=Math.max(0,round2(r.amount-paid));
  const payments=settling&&delta>0?[...base,{id:genId(),amount:delta,date:today,note:'Manual settlement adjustment',kind:'settlement'}]:base;
  return {...r,payments,settled:settling,paid_amount:round2(payments.reduce((s,p)=>s+p.amount,0)),settled_date:settling?today:'',updated:now};
}
function settleRecordsForPerson(records,name,today,now,genId) {
  return records.map(r=>{
    if(r.name.toLowerCase()!==name.toLowerCase()||r.settled)return r;
    const paid=round2(r.payments.reduce((s,p)=>s+p.amount,0)),delta=Math.max(0,round2(r.amount-paid));
    const payments=delta>0?[...r.payments,{id:genId(),amount:delta,date:today,note:'Manual settlement adjustment',kind:'settlement'}]:r.payments;
    return {...r,payments,settled:true,paid_amount:round2(payments.reduce((s,p)=>s+p.amount,0)),settled_date:today,updated:now};
  });
}
function calculateSummary(records) {
  let totalLent=0,totalBorrowed=0,pendingReceivable=0,pendingPayable=0,settledCount=0;
  for(const r of records){if(r.type==='lent'){totalLent=round2(totalLent+r.amount);if(!r.settled)pendingReceivable=round2(pendingReceivable+r.amount-r.paid_amount);}else{totalBorrowed=round2(totalBorrowed+r.amount);if(!r.settled)pendingPayable=round2(pendingPayable+r.amount-r.paid_amount);}if(r.settled)settledCount++;}
  return {totalLent,totalBorrowed,netBalance:round2(pendingReceivable-pendingPayable),pendingReceivable,pendingPayable,settlementRate:records.length?Math.round(settledCount/records.length*100):0,totalRecords:records.length,settledRecords:settledCount};
}
function calculatePeopleStats(records) {
  const map=new Map();
  for(const r of records){const k=r.name.toLowerCase();if(!map.has(k))map.set(k,{name:r.name,totalLent:0,totalBorrowed:0,netBalance:0,recordCount:0,records:[]});const p=map.get(k);p.recordCount++;p.records.push(r);if(!r.settled){const rem=round2(r.amount-r.paid_amount);if(r.type==='lent')p.totalLent=round2(p.totalLent+rem);else p.totalBorrowed=round2(p.totalBorrowed+rem);}}
  for(const p of map.values())p.netBalance=round2(p.totalLent-p.totalBorrowed);
  return [...map.values()].sort((a,b)=>Math.abs(b.netBalance)-Math.abs(a.netBalance));
}
function sanitizeRestoredRecords(raw,{today,now,genId}) {
  if(!Array.isArray(raw))return [];
  return raw.filter(Boolean).map(item=>{
    const id=typeof item.id==='string'&&item.id?item.id:genId(),type=item.type==='borrowed'?'borrowed':'lent',name=typeof item.name==='string'&&item.name.trim()?item.name.trim():'Unknown';
    const amount=round2(Math.max(0,Number(item.amount)||0));
    const payments=Array.isArray(item.payments)?item.payments.map(p=>({id:typeof p.id==='string'&&p.id?p.id:genId(),amount:round2(Math.max(0,Number(p.amount)||0)),date:typeof p.date==='string'?p.date:today,note:typeof p.note==='string'?p.note:'',...(p.kind==='settlement'?{kind:'settlement'}:{})})):[];
    const sum=round2(payments.reduce((s,p)=>s+p.amount,0)),paid_amount=round2(Math.max(sum,Number(item.paid_amount)||0)),settled=Boolean(item.settled)||(amount>0&&paid_amount>=amount);
    return {id,type,name,amount,paid_amount,note:typeof item.note==='string'?item.note:'',date:typeof item.date==='string'?item.date:today,due_date:typeof item.due_date==='string'?item.due_date:'',settled,settled_date:item.settled_date||(settled?today:''),payments,created:typeof item.created==='string'?item.created:now,updated:typeof item.updated==='string'?item.updated:now};
  });
}
module.exports={round2,parseRecordDate,createLoanRecord,addPaymentToRecord,deletePaymentFromRecord,toggleSettlementRecord,settleRecordsForPerson,calculateSummary,calculatePeopleStats,sanitizeRestoredRecords};
