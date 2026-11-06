// NEO Baseball - deterministic, side-effect-free nine-inning rules engine.
// Home: user, away: CPU. Regulation: 9 innings, optional extras through 12.
export function newGame(){
 return {inning:1,half:'top',outs:0,balls:0,strikes:0,bases:[false,false,false],
 scores:{user:0,cpu:0},line:{user:[],cpu:[]},
 stats:{user:{hits:0,hr:0,walks:0,strikeouts:0},cpu:{hits:0,hr:0,walks:0,strikeouts:0}},
 bat:{level:1,xp:0,coins:0},pitchCount:0,over:false,winner:null,last:'플레이볼! 1회 초 · 수비부터 시작합니다.',history:[]};
}
export const offense=g=>g.half==='top'?'cpu':'user';
export const defense=g=>g.half==='top'?'user':'cpu';
export const batUpgradeCost=g=>45*g.bat.level;
export function upgradeBat(g){
 if(g.over||g.bat.level>=10||g.bat.coins<batUpgradeCost(g))return {game:g,success:false};
 const n=clone(g);n.bat.coins-=batUpgradeCost(n);n.bat.level++;
 n.last='배트 레벨 '+n.bat.level+' 달성 · 타격 허용 타이밍과 장타 확률 상승';
 return {game:n,success:true};
}
function clone(g){return {...g,bases:[...g.bases],scores:{...g.scores},
 line:{user:[...g.line.user],cpu:[...g.line.cpu]},
 stats:{user:{...g.stats.user},cpu:{...g.stats.cpu}},bat:{...g.bat},history:[...g.history]};}
function addRun(g,team,n=1){g.scores[team]+=n;g.line[team][g.inning-1]=(g.line[team][g.inning-1]||0)+n;}
function forceWalk(g,team){
 const b=g.bases;
 if(b[0]&&b[1]&&b[2])addRun(g,team);
 b[2]=b[2]||(b[0]&&b[1]);
 b[1]=b[1]||b[0];b[0]=true;
}
function advance(g,team,n){
 const old=g.bases.slice();g.bases=[false,false,false];
 for(let i=2;i>=0;i--)if(old[i]){if(i+n>=3)addRun(g,team);else g.bases[i+n]=true;}
 if(n>=4)addRun(g,team);else g.bases[n-1]=true;
}
function endHalf(g){
 if(g.half==='top'){
  if(g.inning>=9&&g.scores.user>g.scores.cpu){
   g.over=true;g.winner='user';g.last+=' · 홈팀 리드로 경기 종료';return;
  }
  g.half='bottom';
 }else{
  if(g.inning>=9&&g.scores.user!==g.scores.cpu){
   g.over=true;g.winner=g.scores.user>g.scores.cpu?'user':'cpu';g.last+=' · 경기 종료';return;
  }
  if(g.inning>=12){g.over=true;g.winner='draw';g.last+=' · 12회 종료 무승부';return;}
  g.inning++;g.half='top';
 }
 g.outs=0;g.balls=0;g.strikes=0;g.bases=[false,false,false];
 g.last+=' · '+g.inning+'회 '+(g.half==='top'?'초 · 수비':'말 · 공격')+' 시작';
}
export function record(g,kind){
 if(g.over)return g;
 const n=clone(g),team=offense(n),prevRuns=n.scores[team];
 n.pitchCount++;
 const label={ball:'볼',strike:'스트라이크',foul:'파울',walk:'볼넷',single:'안타',double:'2루타',
 triple:'3루타',home_run:'홈런',groundout:'땅볼 아웃',flyout:'뜬공 아웃',strikeout:'삼진'}[kind];
 if(!label)throw Error('Unknown play: '+kind);
 n.last=label;
 if(kind==='ball'){n.balls++;if(n.balls>=4)kind='walk';}
 if(kind==='strike'){n.strikes++;if(n.strikes>=3)kind='strikeout';}
 if(kind==='foul'&&n.strikes<2)n.strikes++;
 if(kind==='walk'){forceWalk(n,team);n.stats[team].walks++;n.balls=0;n.strikes=0;n.last='볼넷 · 타자 1루 진루';}
 if(['single','double','triple','home_run'].includes(kind)){
  const bases={single:1,double:2,triple:3,home_run:4}[kind];
  advance(n,team,bases);n.stats[team].hits++;
  if(kind==='home_run')n.stats[team].hr++;
  n.balls=0;n.strikes=0;
  if(team==='user'){
   const gain={single:22,double:32,triple:45,home_run:65}[kind];
   n.bat.coins+=gain;n.bat.xp+=gain;
  }
 }
 if(['groundout','flyout','strikeout'].includes(kind)){
  n.outs++;n.balls=0;n.strikes=0;
  if(kind==='strikeout')n.stats[team].strikeouts++;
 }
 const runs=n.scores[team]-prevRuns;
 if(runs>0)n.last+=' · '+runs+'점 득점!';
 n.history.push({inning:n.inning,half:n.half,team,kind,runs});
 if(n.history.length>200)n.history.shift();
 // Home team wins immediately on taking the lead in the bottom of the 9th or later.
 if(n.half==='bottom'&&n.inning>=9&&n.scores.user>n.scores.cpu){
  n.over=true;n.winner='user';n.last+=' · 끝내기 승리!';return n;
 }
 if(n.outs>=3)endHalf(n);
 return n;
}
export function cpuPitch(rng=Math.random){
 const roll=rng(),pitch=roll<.45?0:roll<.66?1:roll<.81?2:roll<.93?3:4;
 return {pitch,speed:Math.round((pitch===0?138:118)+rng()*25),zone:rng()<.72?'strike':'ball'};
}
export function cpuSwing({pitch,speed,zone},rng=Math.random){
 // AI has plate discipline and may intentionally take outside pitches.
 const outside=zone==='ball';
 const swings=rng()<(outside?.31:.76);
 if(!swings)return {kind:outside?'ball':'strike'};
 const challenge=(speed-100)/110+(pitch>=4?.16:pitch===1||pitch===3?.10:0);
 const contactChance=Math.max(.28,Math.min(.88,.79-challenge));
 if(rng()>contactChance)return {kind:'strike'};
 if(rng()<.19)return {kind:'foul'};
 return {kind:'contact',lane:['left','center','right'][Math.floor(rng()*3)],
 trajectory:rng()<.52?'ground':'fly',power:rng()};
}
export function battingSwing({progress,ballX,batLevel=1,rng=Math.random}){
 const window=.105+Math.min(9,batLevel-1)*.010;
 const error=Math.abs(1-progress),quality=Math.max(0,1-error/window);
 if(error>=window)return {kind:'strike',quality:0};
 const centerPenalty=Math.min(.45,Math.abs(ballX)*.13);
 const power=quality-centerPenalty+Math.min(.18,(batLevel-1)*.018);
 if(rng()<.09)return {kind:'foul',quality};
 if(power>.86&&rng()<.34)return {kind:'home_run',quality};
 if(power>.62)return {kind:rng()<.32?'double':'single',quality};
 if(power>.38)return {kind:rng()<.55?'single':'flyout',quality};
 return {kind:rng()<.4?'single':'groundout',quality};
}
export function fieldResult({chosen,lane,trajectory,power},rng=Math.random){
 if(!chosen)return power>.60?'double':'single';
 if(chosen===lane){
  if(rng()<(.88-Math.max(0,power-.65)*.28))return trajectory==='fly'?'flyout':'groundout';
  return 'single';
 }
 return power>.65?'double':'single';
}
