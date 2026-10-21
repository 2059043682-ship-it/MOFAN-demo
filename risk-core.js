/* 可解释的演示预警；不调用模型，不确认财务口径，不修改来源数据。 */
(function(root){
'use strict';
const C=root.ShowcaseCore||(typeof require==='function'?require('./core.js'):null);
const definitions=[
 {id:'loss',name:'经营利润低于底线',unit:'万元',value:0,min:-1000,max:1000,op:'lt',severity:'red',domain:'financial',owner:'经营负责人 + 财务',formula:'收入 − 成本 − 经营体费用 − 公司共享费用（仅公司）',meaning:'先找亏损贡献，不能直接归因为人员、租金或某家门店。',next:'核对完整期间、成本、一次性重组费用及关账调整；按经营体拆解。'},
 {id:'revenue',name:'收入目标缺口',unit:'%',value:5,min:0,max:100,op:'gt',severity:'amber',domain:'financial',owner:'经营体负责人',formula:'（示例预算收入 − 示例收入）÷ 示例预算收入 × 100%',meaning:'目标差额不是同比下降；预算本身也需要审批。',next:'先核实目标版本、营业范围、退货和税口径，再按店/平台/商品找差异。'},
 {id:'margin',name:'毛利率较上月下降',unit:'百分点',value:2,min:0,max:100,op:'gt',severity:'amber',domain:'financial',owner:'商品 / 业务 + 财务',formula:'上月（收入−成本）÷收入 − 本月（收入−成本）÷收入，以百分点比较',meaning:'毛利率变化可能来自货品结构、折扣、退货或成本，当前数据无法判定原因。',next:'核对两期收入成本匹配，补款色码、折扣、退货和成本明细；不要把百分点说成百分比。'},
 {id:'expense',name:'经营体费用超预算',unit:'%',value:3,min:0,max:100,op:'gt',severity:'amber',domain:'financial',owner:'费用责任部门 + 财务',formula:'（经营体费用 − 同范围示例费用预算）÷ 同范围费用预算 × 100%',meaning:'公司共享费用未提供预算，不进入这项预算比较。',next:'对照费用类别、预算版本、合同与跨期；核实刚性费用、可变费用和重组一次性费用。'},
 {id:'ar',name:'逾期应收占比',unit:'%',value:30,min:0,max:100,op:'gt',severity:'red',domain:'receivables',owner:'财务应收岗 + 业务',formula:'到期日早于所选月末且未核销金额>0的余额 ÷ 未核销应收总额 × 100%',meaning:'逾期不等于坏账，未核销也可能存在已到账待匹配。',next:'逐笔核对到账、核销、争议和合同到期；按合作方列回款承诺，不能直接计提坏账。'},
 {id:'ap',name:'逾期应付占比',unit:'%',value:20,min:0,max:100,op:'gt',severity:'amber',domain:'payables',owner:'财务应付岗 + 采购',formula:'到期日早于所选月末且未核销金额>0的余额 ÷ 未核销应付总额 × 100%',meaning:'供应商风险还取决于争议、协商和供货依赖，比例本身不能决定付款优先级。',next:'核对账期、已付款未核销与争议；结合工资税费、必要供货及资金计划，由负责人审批。'},
 {id:'stock',name:'长库龄库存金额占比',unit:'%',value:30,min:0,max:100,op:'gt',severity:'amber',domain:'inventory',owner:'商品负责人 + 三经营体',formula:'库龄超过演示天数的快照金额 ÷ 同范围库存快照金额 × 100%',meaning:'长库龄不直接等于滞销或减值；不同季节、货权和价带要分开评估。',next:'按款色码、季节、仓店核对可售、残次和货权；补销量/退货/折扣再决定调拨、促销或减值。'},
 {id:'cash',name:'现金与近期应付压力',unit:'万元',value:0,min:0,max:10000,op:'lt',severity:'red',domain:'cash',owner:'财务负责人',formula:'公司可用现金 −（已逾期应付 + 未来7天到期应付）',meaning:'这是静态压力差额，不是资金预测；不含未入账工资税费、采购承诺、未来回款等。',next:'核实可用/受限余额、付款核销和合同争议；补13周资金计划，禁止据此自动停止付款。'}
];
function defaults(){return {version:'DEMO-WATCH-1.0',status:'演示阈值 / 未获公司批准',ageDays:180,values:Object.fromEntries(definitions.map(r=>[r.id,r.value]))};}
function validateConfig(config){
 if(!config||config.version!=='DEMO-WATCH-1.0'||!Number.isInteger(config.ageDays)||config.ageDays<1||config.ageDays>1460)throw Error('演示库龄须为1—1460的整数天');
 for(const r of definitions)if(!Number.isFinite(config.values?.[r.id])||config.values[r.id]<r.min||config.values[r.id]>r.max)throw Error(r.name+'超出可演示范围');
 return config;
}
const total=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
const validMoney=(rows,keys)=>rows.length>0&&rows.every(r=>keys.every(k=>Number.isSafeInteger(r[k])&&Math.abs(r[k])<Number.MAX_SAFE_INTEGER/10000));
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s;}
function inspect(data,period,unit='',config=defaults()){
 C.validate(data);validateConfig(config);if(!data.periods.find(p=>p.period===period)||!['',...C.codes].includes(unit))throw Error('请选择有效演示期间与经营体');
 const select=(name,p=period)=>C.select(data,name,p,unit),financial=select('financial'),hq=unit?[]:C.select(data,'shared',period),index=data.periods.findIndex(p=>p.period===period),previous=index>0?data.periods[index-1].period:null;
 const asof=data.periods[index].asof,proper=validDate(asof),finOK=financial.length===(unit?1:3)&&new Set(financial.map(r=>r.unit)).size===financial.length&&validMoney(financial,['revenue','cost','expense'])&&(unit||hq.length===1&&validMoney(hq,['amount']));
 const result=[];
 function add(id,value,records,reason='',extra={}){
  const rule=definitions.find(r=>r.id===id),threshold=config.values[id],available=Number.isFinite(value),hit=available&&(rule.op==='gt'?value>threshold:value<threshold);
  result.push({...rule,threshold,value:available?value:null,status:available?(hit?'hit':'clear'):'unavailable',reason,period,scope:unit||'company',version:config.version,approval:'演示规则，待财务批准',sourceIds:[...new Set(records.map(r=>r.id))],records,...extra});
 }
 const revenue=finOK?total(financial,'revenue'):NaN,cost=finOK?total(financial,'cost'):NaN,expense=finOK?total(financial,'expense'):NaN,profit=revenue-cost-expense-total(hq,'amount');
 add('loss',finOK?profit/1000000:null,[...financial,...hq],finOK?'':'利润来源缺失、重复或金额无效');
 const budgetOK=finOK&&validMoney(financial,['budget_revenue'])&&total(financial,'budget_revenue')>0;
 add('revenue',budgetOK?(total(financial,'budget_revenue')-revenue)/total(financial,'budget_revenue')*100:null,financial,budgetOK?'':'缺少正数预算或收入基准');
 const prior=previous?select('financial',previous):[],priorOK=prior.length===financial.length&&validMoney(prior,['revenue','cost'])&&new Set(prior.map(r=>r.unit)).size===prior.length;
 add('margin',finOK&&priorOK&&revenue>0&&total(prior,'revenue')>0?((total(prior,'revenue')-total(prior,'cost'))/total(prior,'revenue')-(revenue-cost)/revenue)*100:null,[...financial,...prior],previous?'两期收入必须为正且同范围完整':'第一个演示月无上月基准');
 const expenses=financial.flatMap(r=>r.expenses||[]),expOK=finOK&&validMoney(expenses,['amount','budget'])&&total(expenses,'amount')===expense&&total(expenses,'budget')>0;
 add('expense',expOK?(expense-total(expenses,'budget'))/total(expenses,'budget')*100:null,financial,expOK?'':'费用预算、费用明细或加总不完整');
 const ledgers={};
 for(const [id,name] of [['ar','receivables'],['ap','payables']]){
  const rows=select(name),ok=proper&&validMoney(rows,['original','allocated','open'])&&rows.every(r=>validDate(r.due_date)&&r.open>=0&&r.original-r.allocated===r.open),sum=ok?total(rows,'open'):0,overdue=ok?rows.filter(r=>r.due_date<asof&&r.open>0):[];
  ledgers[id]={ok,rows,total:sum,overdue:total(overdue,'open')};
  add(id,ok&&sum>0?total(overdue,'open')/sum*100:null,rows,ok?(sum===0?'余额为零，无占比基数':''):'单据缺失、到期日或余额勾稽异常',{affectedIds:overdue.map(r=>r.id)});
 }
 const stock=select('inventory'),stockOK=validMoney(stock,['quantity','unit_cost','amount'])&&stock.every(r=>r.quantity>=0&&r.unit_cost>=0&&r.amount===r.quantity*r.unit_cost&&Number.isInteger(r.age_days)&&r.age_days>=0),stockTotal=stockOK?total(stock,'amount'):0,older=stockOK?stock.filter(r=>r.age_days>config.ageDays):[];
 add('stock',stockOK&&stockTotal>0?total(older,'amount')/stockTotal*100:null,stock,stockOK?'缺少正数库存金额基数':'快照缺失或数量、成本、库龄异常',{ageDays:config.ageDays,affectedIds:older.map(r=>r.id)});
 const cash=C.select(data,'cash',period),ap=ledgers.ap;
 const cashOK=!unit&&cash.length===1&&validMoney(cash,['opening','closing'])&&validMoney(cash[0].receipts||[],['amount'])&&validMoney(cash[0].payments||[],['amount'])&&cash[0].opening+total(cash[0].receipts,'amount')-total(cash[0].payments,'amount')===cash[0].closing;
 const upcoming=ap.ok?ap.rows.filter(r=>r.due_date>=asof&&(Date.parse(r.due_date+'T00:00:00Z')-Date.parse(asof+'T00:00:00Z'))/86400000<=7):[];
 add('cash',cashOK&&ap.ok?(cash[0].closing-ap.overdue-total(upcoming,'open'))/1000000:null,unit?[]:[...cash,...ap.rows],unit?'现金只在公司层面，不虚构经营体资金分摊':'缺少可用资金或完整应付到期快照',unit?{status:'na'}:{});
 return {period,unit,asof,config:JSON.parse(JSON.stringify(config)),rules:result,hits:result.filter(r=>r.status==='hit'),unavailable:result.filter(r=>r.status==='unavailable'),red:result.filter(r=>r.status==='hit'&&r.severity==='red').length,amber:result.filter(r=>r.status==='hit'&&r.severity==='amber').length};
}
function scenario(data,period,unit='',inputs={}){
 C.validate(data);
 const {revenuePct=0,expensePct=0,collectPct=0}=inputs;
 if(!['',...C.codes].includes(unit)||!data.periods.some(p=>p.period===period))throw Error('演示范围无效');
 if(![revenuePct,expensePct,collectPct].every(Number.isFinite)||revenuePct< -20||revenuePct>20||expensePct<0||expensePct>20||collectPct<0||collectPct>100)throw Error('假设超出范围');
 const checked=inspect(data,period,unit);if(checked.rules.find(r=>r.id==='loss').value===null||checked.rules.find(r=>r.id==='ar').value===null)throw Error('利润或应收基数不足，不能模拟');
 const s=C.summary(data,period,unit);if(s.revenue<=0)throw Error('收入基数不足，不能模拟');
 const gross=s.revenue-s.cost,revenueDelta=Math.round(s.revenue*revenuePct/100),grossDelta=Math.round(gross*revenuePct/100),expenseSaving=Math.round(s.expense*expensePct/100),cashCollection=Math.round(s.ar.overdue*collectPct/100);
 return {baseProfit:s.profit,revenueDelta,grossDelta,expenseSaving,profit:s.profit+grossDelta+expenseSaving,cashCollection,receivableReduction:cashCollection,profitFromCollection:0,scope:unit||'company',assumptions:'毛利率不变、经营体费用按假设减少、共享费用不变；回收已确认应收只模拟现金和应收变化，不再次计入利润。并非预测。'};
}
const api={definitions,defaults,validateConfig,inspect,scenario};root.ManagementCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
