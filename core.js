/* 纯合成演示计算。金额使用安全整数分；正式财务规则/审批未连接。 */
(function(root){
'use strict';
const codes=['ecommerce','direct','outlet'];
const sum=(rows,key)=>rows.reduce((total,row)=>total+(typeof key==='function'?key(row):row[key]),0);
function validate(data){
  if(data.classification!=='demo'||data.source_status!=='未连接任何真实系统')throw Error('公开演示只允许合成数据');
  if(data.units.length!==3||codes.some(code=>!data.units.find(unit=>unit.code===code)))throw Error('经营体范围错误');
  for(const name of ['financial','shared','cash','receivables','payables','inventory','settlements','actions'])
    for(const row of data[name])if(row.demo!==true||!row.id.startsWith('DEMO-'))throw Error('发现非演示记录，停止展示');
}
const select=(data,name,period,unit='')=>data[name].filter(row=>row.period===period&&(!unit||row.unit===unit));
function summary(data,period,unit=''){
  const rows=select(data,'financial',period,unit),shared=unit?0:sum(select(data,'shared',period),'amount');
  const revenue=sum(rows,'revenue'),cost=sum(rows,'cost'),expense=sum(rows,'expense');
  return {revenue,cost,expense,shared,profit:revenue-cost-expense-shared,budget:sum(rows,'budget_revenue'),
    ar:aging(data,'receivables',period,unit),ap:aging(data,'payables',period,unit),stock:stock(data,period,unit),
    cash:unit?null:select(data,'cash',period)[0]};
}
function aging(data,name,period,unit=''){
  const asof=data.periods.find(item=>item.period===period).asof;
  const rows=select(data,name,period,unit).map(row=>({...row,days:Math.max(0,Math.round((Date.parse(asof+'T00:00:00Z')-Date.parse(row.due_date+'T00:00:00Z'))/86400000))}));
  const overdue=rows.filter(row=>row.days>0&&row.open>0);
  const bands=[['未逾期',r=>r.days===0],['逾期1—30天',r=>r.days>0&&r.days<=30],['逾期31—90天',r=>r.days>30&&r.days<=90],['逾期90天以上',r=>r.days>90]];
  return {rows,total:sum(rows,'open'),overdue:sum(overdue,'open'),overdue_count:overdue.length,
    due7:sum(rows.filter(r=>r.due_in_days>=0&&r.due_in_days<=7),'open'),
    bands:bands.map(([label,predicate])=>({label,value:sum(rows.filter(predicate),'open')}))};
}
function stock(data,period,unit=''){
  const rows=select(data,'inventory',period,unit);
  return {rows,quantity:sum(rows,'quantity'),amount:sum(rows,'amount'),older_quantity:sum(rows.filter(r=>r.age_days>180),'quantity'),
    older_amount:sum(rows.filter(r=>r.age_days>180),'amount'),
    bands:[['0—90天',r=>r.age_days<=90],['91—180天',r=>r.age_days>90&&r.age_days<=180],['181—365天',r=>r.age_days>180&&r.age_days<=365],['365天以上',r=>r.age_days>365]].map(([label,p])=>({label,value:sum(rows.filter(p),'amount')}))};
}
function bridge(data,period,unit=''){
  const index=data.periods.findIndex(item=>item.period===period);
  if(index<1)return null;
  const prev=data.periods[index-1].period,a=summary(data,prev,unit),b=summary(data,period,unit);
  const parts=[{label:'收入变化贡献',value:b.revenue-a.revenue},{label:'成本变化贡献',value:a.cost-b.cost},
    {label:'经营体费用贡献',value:a.expense-b.expense},{label:'共享费用贡献',value:a.shared-b.shared}];
  return {previous:prev,opening:a.profit,closing:b.profit,delta:b.profit-a.profit,parts};
}
function observations(data,period,unit=''){
  const s=summary(data,period,unit),change=bridge(data,period,unit),out=[];
  if(change){const negative=[...change.parts].sort((a,b)=>a.value-b.value)[0],positive=[...change.parts].sort((a,b)=>b.value-a.value)[0];
    if(positive.value>0)out.push({type:'good',title:'可以关注的改善',text:`示例${positive.label}为正。先核对是否同口径、同范围和完整期间，再解释原因。`,amount:positive.value,source:'financial'});
    if(negative.value<0)out.push({type:'attention',title:'需要核验的变化',text:`示例${negative.label}为负。它是数学贡献，不自动等于经营原因。`,amount:negative.value,source:'financial'});
  }
  if(s.ar.overdue>0)out.push({type:'attention',title:'回款需要跟进',text:`示例有${s.ar.overdue_count}笔未核销款项已过到期日；先核对到账、核销与争议，不直接判坏账。`,amount:s.ar.overdue,source:'receivables'});
  if(s.stock.older_amount>0)out.push({type:'attention',title:'商品需要复核',text:'示例有超过180天的快照库存。180天仅为演示分组，不是公司预警阈值；先查货权和首次入库。',amount:s.stock.older_amount,source:'inventory'});
  return out;
}
const core={sum,validate,select,summary,aging,stock,bridge,observations,codes};
root.ShowcaseCore=core;if(typeof module!=='undefined')module.exports=core;
})(globalThis);
