/* 管理者视图：可解释规则 + 证据 + 人工核验计划，公开站无真实后台。 */
(function(root){
'use strict';
root.ShowcaseManagement={setup(api){
 const {D,C,state,el,button,panel,grid,note,append,kpis,rowsTable,bars,money,details,go,titles,renderers}=api,R=root.ManagementCore;
 let config=R.defaults(),viewFilter='all';
 const names={ecommerce:'电商',direct:'正价',outlet:'奥莱',company:'公司'},$=id=>document.getElementById(id);
 const pct=n=>Number.isFinite(n)?n.toFixed(2)+'%':'无法计算';
 const value=r=>r.value===null?'数据不足':r.value.toFixed(2)+' '+r.unit;
 const status=r=>({hit:r.severity==='red'?'演示红线触发':'演示关注触发',clear:'本规则未触发',unavailable:'数据不足',na:'不适用'})[r.status];
 const all=()=>R.inspect(D,state.period,state.unit,config);
 function download(filename,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=el('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function formula(r){return r.formula+(r.id==='stock'?`；当前演示库龄界限 ${r.ageDays||config.ageDays} 天`:'');}
 function evidence(r){
  if(r.status==='na'){ $('feedback').textContent=r.reason;return; }
  const open=()=>{
   const id=r.id==='cash'?'cash':r.domain;details(id);
   state.detail={domain:id,rows:r.records.filter(x=>id==='cash'?x.id.startsWith('DEMO-CASH-'):id==='financial'?x.id.startsWith('DEMO-PL-'):true)};
   $('detail-title').textContent=r.name+' · 计算依据';
   $('detail-note').textContent=`${r.period} / ${names[r.scope]} / 演示规则 ${r.version}（未获财务批准）；${formula(r)}。本规则值 ${value(r)}，演示条件 ${r.op==='gt'?'>':'<'} ${r.threshold} ${r.unit}。明细包括分子和分母，不只显示异常行；毛利比较包含上月。`+(r.affectedIds?.length?' 命中单据/库存来源：'+r.affectedIds.join('、'):'')+(r.id==='cash'?' 此表为资金来源；应付构成需继续查看应付明细。':'');
   $('detail-note').textContent+=' 全部计算来源：'+r.records.map(x=>x.id+'（'+x.source.sheet+'第'+x.source.row+'行）').join('、');api.renderDetail();
  };open();
 }
 function exportCheck(){
  const x=all(),lines=[`MOFAN 经营体检 / 纯合成演示 / ${x.period} / ${names[state.unit||'company']}`,`演示时点 ${x.asof}；非实时，公司数据未接入；规则 ${config.version}，全部未获财务批准。`,
   '这是确定性规则计算，不是大模型诊断；当前结果并非公司真实问题。',`演示红线 ${x.red} 项，关注 ${x.amber} 项，数据不足 ${x.unavailable.length} 项。信号可能重叠，不汇总成损失或节省收益。`,
   ...x.rules.map(r=>[r.name+'：'+status(r),`数值 ${value(r)}；演示条件 ${r.op==='gt'?'>':'<'} ${r.threshold} ${r.unit}`,formula(r),r.reason,`核验岗位：${r.owner}；建议：${r.next}`,`依据 ${r.sourceIds.join('、')}`].filter(Boolean).join('\n')),
   '资料缺口：现金预测、退款率、真实投放ROI、门店盈亏/同店、人效/坪效、动销/售罄/周转、合同联营核对尚未具备。',
   '来源 DEMO-经营样本.xlsx；SHA256 '+D.source_sha256,'来源记录可在明细中查询工作表与行号。配置只在本标签页内演示，刷新重置，没有审批、共享留存、通知或自动处理。'];
  download(`DEMO-经营体检-${state.period}.txt`,lines.join('\n\n'));
 }
 function diagnostic(){
  const x=all(),intro=el('section',null,'decision-hero');intro.append(el('span','MANAGEMENT REVIEW / 仅合成演示','eyebrow'),el('h2','先回答：哪里需要关注，下一步查什么？'),el('p','这是一次按规则检查，不是AI替您下经营结论。先核来源，再核业务原因，最后由负责人决定行动。'));
  const tools=el('div',null,'management-tools');tools.append(button('重新体检当前范围',()=>{diagnosticRefresh();}),button('调整演示红线',()=>go('watchrules'),'quiet'),button('下载本次体检依据',exportCheck,'quiet'));intro.append(tools);append(intro);
  append(kpis([['演示红线触发',x.red+' 项','仅当前演示规则，不是公司正式警报'],['演示关注触发',x.amber+' 项','按优先级人工核验，不汇总成损失'],['无法判断',x.unavailable.length+' 项','缺数据不显示为绿色安全']]));
  const filter=el('div',null,'management-tools');for(const [key,label] of [['all','全部检查'],['hit','只看触发'],['unavailable','只看数据不足']])filter.append(button(label,()=>{viewFilter=key;diagnosticRefresh();},key===viewFilter?'':'quiet'));append(filter);
  const order={red:0,amber:1},rules=[...x.rules].sort((a,b)=>(a.status==='hit'?order[a.severity]:a.status==='unavailable'?2:3)-(b.status==='hit'?order[b.severity]:b.status==='unavailable'?2:3));
  const cards=el('div',null,'diagnostic-grid');for(const r of rules.filter(r=>viewFilter==='all'||r.status===viewFilter)){
   const card=el('article',null,'diagnostic-card '+(r.status==='hit'?r.severity:'neutral'));
   card.append(el('span',status(r),'chip '+(r.status==='hit'?'warn':'')),el('h3',r.name),el('strong',value(r),'diagnostic-value'),el('p',`演示条件：${r.op==='gt'?'大于':'低于'} ${r.threshold} ${r.unit}；等于界限不触发。`),el('p',r.status==='unavailable'||r.status==='na'?r.reason:r.meaning),el('p','建议核验：'+r.next),el('small',`建议岗位：${r.owner} / 演示规则未批准`));
   const buttons=el('div',null,'management-tools');buttons.append(button('查看计算和来源',()=>evidence(r),'quiet'),button('看完整明细',()=>details(r.domain),'quiet'));card.append(buttons);cards.append(card);
  }if(!cards.children.length)cards.append(note('当前筛选没有记录，不代表其他指标安全。'));append(cards);
  if(!state.unit){
   const rows=D.units.map(u=>{const s=C.summary(D,state.period,u.code);return {...u,...s,check:R.inspect(D,state.period,u.code,config)};});
   const p=panel('三大经营体：哪里承压、哪里有改善？','经营体利润均为公司共享费用分摊前，不能和公司净结果混用。触发项数不是经营体排名或绩效评分。'),wrap=el('div',null,'table-wrap');
   wrap.append(rowsTable([['经营体',r=>r.name],['示例收入',r=>money(r.revenue)],['毛利率',r=>pct((r.revenue-r.cost)/r.revenue*100)],['共享前利润',r=>money(r.profit)],['示例逾期应收',r=>money(r.ar.overdue)],['触发检查',r=>r.check.hits.length+'项'],['下一步',r=>button('查看此经营体',()=>{state.unit=r.code;$('unit').value=r.code;diagnosticRefresh();},'quiet')]],rows));p.append(wrap);append(p);
  }
  const change=C.bridge(D,state.period,state.unit);if(change){append(bars('利润变化贡献：先区分影响，再核实原因',change.parts));append(note('正向贡献可作为改善线索，负向贡献作为核验线索。不要直接把费用减少当效率提升，可能有跨期、停业或一次性调整；先核对口径。'));}
  append(coveragePanel());append(note(`本次体检范围 ${x.period} / ${names[state.unit||'company']}；规则 ${config.version}，来源哈希 ${D.source_sha256}。逾期、利润、库存指标可能重叠，不相加为“总损失”。演示不发送短信/邮件、不自动付款、不改账；真实闭环尚未实现。`));
 }
 function diagnosticRefresh(){ $('page-content').replaceChildren();diagnostic(); }
 const gaps=[
  ['13周现金安全','未具备','账户可用/受限余额、应收承诺、工资税费、采购承诺、偿债与融资计划','财务负责人','不能把静态应付压力差当预测或续航天数'],
  ['电商退款与投放效益','未具备','原订单、取消退款关联、平台扣费、结算与实际投放归因','电商 + 财务','成交额不等于收入；不能用收入÷营销费冒充真实ROI'],
  ['正价门店真实贡献','未具备','店号、营业天数、租约、门店费用、销售退货与同店基准','正价负责人','当前只有经营体汇总，不能判断哪家门店该关'],
  ['商品售罄与补货','未具备','款色码、上市/首入库、销售退货、采购到货和完整库存流水','商品 + 伯俊对接','快照库龄不是动销或周转；调拨不等于销售'],
  ['奥莱联营结算差异','未具备','合同版本、货权、扣项、账期、应收、到账核销匹配','奥莱 + 财务','目前仅演示应结关系，未清款不能直接判逾期'],
  ['重组改善是否兑现','未具备','一次性支出、经常性费用、已审批计划、同范围基准和验收','财务 + 经营负责人','不能把裁减成本或停店直接认定为净收益'],
  ['数据新鲜度与完整性','未接入','源更新时间、最后成功、覆盖期间、行数/金额控制总数、重试日志','IT + 财务','公开页无同步任务，刷新页面不等于同步真实数据']
 ];
 function coveragePanel(){const p=panel('这些问题当前还不能回答','缺资料必须明确留空；下面是服装企业管理方法框架，并非杭州行业统计或西歌真实诊断。'),wrap=el('div',null,'table-wrap');wrap.append(rowsTable([['问题',r=>r[0]],['状态',r=>r[1]],['需要资料',r=>r[2]],['对接岗位',r=>r[3]],['判断边界',r=>r[4]]],gaps));p.append(wrap);return p;}
 function rulesPage(){
  append(note('红线不是行业通用标准。本页仅让您理解预警如何工作；数值均是演示假设，不是财务负责人批准的经营底线。调整只对当前浏览器标签页有效，刷新重置，其他访问者看不到。'));
  const p=panel('演示红线实验台','先明确指标、适用范围、分母、期间、比较方向和负责人，再由公司审批上线。当前不具备正式规则审批、历史留存或通知。'),form=el('form'),wrap=el('div',null,'rule-input-grid');
  for(const r of R.definitions){const label=el('label',r.name+'（'+r.unit+'）'),input=el('input');input.type='number';input.min=r.min;input.max=r.max;input.step='0.01';input.value=config.values[r.id];input.name=r.id;input.required=true;input.setAttribute('aria-label',r.name);label.append(input,el('small',`${r.op==='gt'?'大于':'低于'}界限触发；${r.formula}`));wrap.append(label);}
  const age=el('label','长库龄界限（天）'),input=el('input');input.name='ageDays';input.type='number';input.min='1';input.max='1460';input.step='1';input.required=true;input.value=config.ageDays;age.append(input);wrap.append(age);form.append(wrap);
  const msg=el('p','尚未修改；所有规则均未获批准。','note-box');msg.setAttribute('role','status');const tools=el('div',null,'management-tools'),save=el('button','应用演示并查看体检');save.type='submit';tools.append(save,button('恢复默认演示阈值',()=>{config=R.defaults();api.render();},'quiet'));form.append(tools,msg);
  form.addEventListener('submit',event=>{event.preventDefault();try{const fields=new FormData(form),next=R.defaults();next.ageDays=Number(fields.get('ageDays'));for(const r of R.definitions)next.values[r.id]=Number(fields.get(r.id));R.validateConfig(next);config=next;go('diagnosis');}catch(error){msg.textContent=error.message;}});p.append(form);append(p);
  const columns=[['规则',r=>r.name],['比较',r=>`${r.op==='gt'?'>':'<'} ${config.values[r.id]} ${r.unit}`],['核验岗位',r=>r.owner],['判断边界',r=>r.meaning]];const list=panel('当前演示规则目录','版本 DEMO-WATCH-1.0 / 适用于所选演示月末，毛利变动需要相邻完整月 / 所有规则待批准。');const table=el('div',null,'table-wrap');table.append(rowsTable(columns,R.definitions));list.append(table);append(list);
  append(note('正式流程建议：财务提出定义与阈值 → 业务验证适用范围/季节/经营体 → IT用历史完整数据回测误报和漏报 → 指定责任人与响应时限 → 审批版本/生效期 → 人工复核关闭。当前页面只有试算，不是上述流程已完成。公司范围与各经营体阈值将来可独立配置，不应一套阈值硬套所有门店。'));
 }
 function dataHub(){
  append(note('这里是“演示数据明细台”，可以展开查看具体合成记录。公开网页没有真实后台、数据库登录或权限管理，不要在此上传公司财务文件。'));
  const p=panel('看清数据：从结论追到工作表与行','按上方月份/经营体过滤；打开后可搜索、排序、翻页，金额保留到元。下载的是合成来源工作簿。'),cards=el('div',null,'connection-grid');
  for(const [domain,label,desc] of [['financial','利润与费用','收入、成本、费用和预算；公司共享费用单列'],['cash','公司可用资金','期初、收款、付款、期末；经营体不强行分摊'],['receivables','应收与核销','合作方、到期日、原值、已核销、未核销'],['payables','应付与核销','供应商、合同到期和未付款快照'],['inventory','库存快照','款色码、季节、仓店、件数、示例成本与库龄'],['settlements','奥莱内部联营','合同版本、扣项、应结与回款；仅奥莱内部']]){
   const card=el('article',null,'connection-card'),count=C.select(D,domain,state.period,domain==='cash'?'':domain==='settlements'?'outlet':state.unit).length;card.append(el('h3',label),el('p',desc),el('span',`${count} 条合成记录`,'chip'));
   if(domain==='settlements'&&state.unit&&state.unit!=='outlet')card.append(el('p','当前不是奥莱范围；切换到奥莱后查看。'));else if(domain==='cash'&&state.unit)card.append(el('p','资金为公司层面，请先选择公司总览。'));else card.append(button('打开明细 →',()=>details(domain),'quiet'));cards.append(card);
  }p.append(cards);append(p);
  const quality=panel('数据质量：演示身份与完整性分别说明','所有文件是合成生成器输出；不是对公司真实资料执行过质量核验。');quality.append(rowsTable([['检查',r=>r[0]],['当前状态',r=>r[1]]],[['数据身份','全部 DEMO 编号，无真实系统连接'],['范围','MOFAN方案 / 2026年1—8月 / 三大经营体'],['来源追踪','工作簿、工作表、行号、SHA256、规则版本'],['演示勾稽','利润恒等式、资金连续、应收应付原值−核销、库存数量×成本'],['真实数据覆盖/关账','未接入，未复核，未关账；不以零值或绿灯替代'],['人工调整/历史版本','本公开站未实现；正式系统须保留而非覆盖'] ]));append(quality);
  append(button('查看需对接的数据与资源',()=>go('connections'),'quiet'));
 }
 function scenarioPage(){
  append(note('行动模拟回答“如果这样，会怎样”，不是“将会怎样”。只改假设，不改原始数据；不预测需求，不保证节省落地。不能把应收回款再计为利润。'));
  const p=panel('经营假设试算','假设毛利率不变、经营体费用按比例减少、公司共享费用保持不变；未模拟税、产能、折扣、退货和执行成本。'),form=el('form'),fields=el('div',null,'rule-input-grid');
  for(const [key,label,min,max] of [['revenuePct','收入变化假设（-20%～20%）',-20,20],['expensePct','经营体费用减少假设（0%～20%）',0,20],['collectPct','逾期应收收回假设（0%～100%）',0,100]]){const l=el('label',label),i=el('input');i.type='number';i.min=min;i.max=max;i.step='0.1';i.required=true;i.value='0';i.name=key;i.setAttribute('aria-label',label);l.append(i);fields.append(l);}form.append(fields);const submit=el('button','计算假设结果');submit.type='submit';form.append(submit);const output=el('div');output.id='scenario-output';const calc=()=>{try{const values=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,Number(v)])),s=R.scenario(D,state.period,state.unit,values);output.replaceChildren(kpis([['模拟经营利润',money(s.profit),'不代表正式利润或预测'],['相对基准变化',money(s.profit-s.baseProfit),'毛利贡献 + 经营体费用节省'],['假设回款增加',money(s.cashCollection),'只改变现金/应收，不重复增加利润']]));output.append(note(`示例基准利润 ${money(s.baseProfit)}；收入假设带来的毛利贡献 ${money(s.grossDelta)}；费用减少 ${money(s.expenseSaving)}。${s.assumptions} ${state.unit?'本经营体现金余额没有分摊，不能据此得出其资金余额。':'现金回收是否实现需另经到账核销。'}`));}catch(error){output.replaceChildren(note(error.message));}};form.addEventListener('submit',e=>{e.preventDefault();calc();});p.append(form,output);append(p);calc();append(note('正式改善计划还需要：责任人、可控范围、时间表、资源投入、一次性成本和验收基准。清库存不等于按账面价值全部变现金；尚未建模，因此没有提供“一键清货收益”。'));
 }
 const guideSections=[
  ['第一次用：只看这四步','①选月份和经营体；②点“一键经营体检”；③先看演示红线/关注，再点“查看计算和来源”；④下载体检依据，带着单据与财务、经营体负责人核实。红色表示命中演示条件，并不证明公司有同样的问题。'],
  ['怎么给领导讲：三句话','先讲结果（哪项变化），再讲证据（期间/范围/公式/来源），最后讲安排（谁核实、缺什么、何时反馈）。不要只展示一堆指标，也不要把待核验判断说成确定结论。'],
  ['怎么看底层数据','左侧“数据明细台”→选择应收/应付/库存等→打开明细→搜索、排序、翻页→查看来源工作表/原行。下载合成来源工作簿可逐项对照。这里不是公司真实后台。'],
  ['红线怎么设置','在“演示红线设置”调整数值→应用→回到体检看变化。默认180天等数字只是演示，不是服装行业统一标准。等于界限不触发。配置仅当前标签页内有效，刷新重置，没有审批、保存历史、共享配置或自动通知。'],
  ['一键能指出什么，不能指出什么','能找演示规则命中、数学贡献、到期款项和长库龄快照，列出需核验的记录。不能仅凭汇总认定亏损原因、坏账、关店、裁员、降价或违法违规。缺数据时会写“数据不足”，不能强行给结论。'],
  ['模拟与实际有什么区别','“行动模拟”是手动假设的敏感性计算，不是销售预测。收入假设按现有毛利率计算，费用节省不含执行成本。收回已经确认的应收不再增加利润，利润与现金不混用。'],
  ['公司的真实数据放在哪里','这个公开网址仅放合成演示。正式数据应在公司批准的服务器/虚拟机或获批云环境，配置登录、角色/经营体权限、HTTPS、备份恢复与审计。内网若远程访问，交IT设置受控访问，不把真实台账放到公开GitHub。'],
  ['数据为什么还不是实时','当前没有伯俊、平台或财务接口。先拿一个完整周期核对，然后做受控文件或官方只读API的稳定日批；有正式授权且源支持时，再缩短部分来源频率。数据发生时间、最后同步、覆盖完整性和财务关账应分别显示。'],
  ['AI在这里做什么','当前没有接入大语言模型。这一版是可解释规则引擎 + 固定模板 + 人工假设试算。未来获批模型可在权限范围内概括核验结果、解释数学贡献、草拟经营会材料；不能自动改账、付款、改红线或批准关账。'],
  ['你作为总助，怎样组织试点','先与财务负责人选一完整月份和一个经营体，拿利润基准/明细、可用资金、应收核销、应付核销、销售退货、商品主数据与库存快照。明确每项资料负责人和口径签认人，用“数据与接入”清单交接；不要收集密码。核对后再扩大三经营体。'],
  ['每周怎样开经营会','建议流程：财务说明完整性和口径状态→看现金与回款→看亏损贡献与费用→看商品库存与各经营体→对每项形成核验任务、责任岗位和反馈日期。处理状态、财务关账、实际改善收益要分别验收。当前站不保存任务。']
 ];
 function guide(){
  append(note('阅读顺序：先学四步操作，再理解红线、明细和模型边界。全站为合成演示；您看到的数字不代表公司实际。'));
  const p=panel('通俗使用说明','需要留档可下载同内容的文字说明，也可使用浏览器打印/另存为PDF。');p.append(button('下载详细使用说明',()=>download('MOFAN-管理者使用说明.txt',guideText()),'quiet'));
  guideSections.forEach(([title,text],i)=>{const fold=el('details',null,'guide-fold');fold.open=i<2;fold.append(el('summary',title),el('p',text));p.append(fold);});append(p);
  const model=panel('这个“模型”的优点与不足','它是管理框架和规则引擎，不是训练完成的财务预测模型，也没有使用公司真实数据训练。'),wrap=el('div',null,'table-wrap');wrap.append(rowsTable([['方面',r=>r[0]],['优点 / 作用',r=>r[1]],['不足 / 边界',r=>r[2]]],[
   ['规则体检','公式、阈值、来源可解释，可测试，避免凭感觉解释','依赖财务口径与完整数据；阈值不当会误报/漏报，当前均待批准'],
   ['经营规划','连接利润、现金、应收应付和商品；区分三经营体','当前汇总颗粒度有限，不能回答具体门店/平台/SKU盈利原因'],
   ['数学贡献','解释两期利润变化与预算偏差，能核对合计','相关变化不是因果，季节性/停店/跨期/重组事项需人工核实'],
   ['行动模拟','将收入、费用、回款假设分开，避免回款重复算利润','固定毛利率等简化假设，不是预测，不保证执行效果'],
   ['人工与AI协作','先核数据和规则，再让获批AI整理证据与报告','当前没有LLM、受控问答、联网取数或自动化经营决策'],
   ['部署与权限','演示站易分享、无需安装，合成数据可重复验证','没有真实后台、登录、共享任务、告警推送或生产接入，不能承载正式财务数据']
  ]));model.append(wrap);append(model);append(coveragePanel());
 }
 function guideText(){return ['MOFAN 管理者使用说明 / V0.11 / 合成演示，非公司实际数据',...guideSections.map(([t,v])=>t+'\n'+v),'模型优点：规则透明、可追溯、可检验；按经营体组织行动。','模型不足：未接入真实数据或AI，无因果识别/预测；无登录、共享审批、告警推送。规则可能误报漏报；所有阈值待批准。','红线规则版本 DEMO-WATCH-1.0；公司经营体包括电商、正价、奥莱，联营归奥莱内部。'].join('\n\n');}
 Object.assign(titles,{diagnosis:['一键经营体检','从风险信号到证据和核验计划；不把规则命中当成公司真实诊断。'],watchrules:['演示红线设置','阈值需财务与业务批准；这里只能试算，不会发布正式预警。'],datahub:['数据明细台','查看合成原始记录、来源和勾稽关系；不是公司真实后台。'],scenario:['行动模拟','把假设说清楚，再看利润和回款如何分别变化。'],guide:['使用说明与模型边界','四步上手，读懂数字、预警、依据与下一步。']});
 Object.assign(renderers,{diagnosis:diagnostic,watchrules:rulesPage,datahub:dataHub,scenario:scenarioPage,guide});
 const old=renderers.overview;renderers.overview=()=>{const p=el('section',null,'quick-diagnosis');const copy=el('div');copy.append(el('h2','不用逐张翻表，先做一次经营体检'),el('p','按所选月份和经营体，检查利润、回款、应付、库存和资金压力；每条都有公式、依据和建议核验岗位。'));p.append(copy,button('一键经营体检 →',()=>go('diagnosis')));append(p);old();};
 $('help-button').addEventListener('click',()=>go('guide'));
 }};
})(globalThis);
