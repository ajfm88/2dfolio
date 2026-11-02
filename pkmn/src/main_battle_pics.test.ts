import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {host,output,loadMainBattleRig,resetMainBattleRig,tick,until,world,mon,row,openParty,frameNow,type Session} from './test/main_battle_rig';
import * as send from './battle/battle_send_out';
import * as slides from './battle/battle_slides';
import * as balls from './battle/battle_ball_animation';
import * as sessions from './battle/battle_session';
import {BattleAudio} from './battle/battle_audio';
import {D} from './battle/battle_end_state';
import {I} from './battle/battle_item_state';
import {W_SPRITE_FLIPPED} from './battle/battle_state';
import {BATTLE_BG_ATTRIBUTES} from './battle/battle_attributes';
import {textBgTransfer} from './text/bg_transfer';
import type {BattleCell,BattleScreen} from './battle/battle_screen';
import type {Program} from './battle/battle_menu_context';

beforeAll(()=>loadMainBattleRig());
beforeEach(()=>{
  resetMainBattleRig();
  // Fixed frame4 with real cycle accounting: outcomes cannot move with presentation waits.
  const create=sessions.createBattleSession;
  vi.spyOn(sessions,'createBattleSession').mockImplementation((world,deps)=>
    create(world,{...deps,random:sessions.createSessionRandom(()=>4)}));
});
afterEach(()=>{host.reset();vi.restoreAllMocks();});
const pulse=()=>frameNow()%4===0?['a'] as const:[];
type Sample={at:number;cells:readonly BattleCell[]};
function* observe(program:Program,screen:BattleScreen,frames:Sample[],done:()=>void):Program{
  for(;;){const next=program.next();if(next.done){done();return;}
    frames.push({at:frameNow(),cells:screen.cells});yield next.value;}
}
function cells(s:BattleScreen,x:number,y:number,w=7,h=7,shown=false){
  return Array.from({length:w*h},(_,i)=>(shown?s.visibleAt(x+i%w,y+Math.floor(i/w)):s.at(x+i%w,y+Math.floor(i/w))));
}
const full=(base:number,flip=false)=>Array.from({length:49},(_,i)=>base+Math.floor(i/7)+(flip?6-i%7:i%7)*7);
function sampleCells(sample:Sample,x:number,y:number,w:number,h:number){
  return Array.from({length:w*h},(_,i)=>sample.cells[(y+Math.floor(i/w))*20+x+i%w]);
}
function hash(pixels:Uint8ClampedArray){return createHash('sha256').update(pixels).digest('hex');}
function region(pixels:Uint8ClampedArray,x:number,y:number,w=56,h=56){
  const result=new Uint8ClampedArray(w*h*4);
  for(let r=0;r<h;r++)result.set(pixels.subarray(((y+r)*160+x)*4,((y+r)*160+x+w)*4),r*w*4);
  return hash(result);
}
function expectPic(s:Session,key:string,x:number,y:number){
  // Independently colour the committed 56x56 pic, without using scanout or its tile lookup.
  const image=s.renderTiles.pictures.get(key)!,expected=new Uint8ClampedArray(56*56*4);
  for(let py=0;py<56;py++)for(let px=0;px<56;px++){
    const at=(py*56+px)*4,gray=image.data[at],shade=gray>=192?0:gray>=128?1:gray>=64?2:3;
    const palette=s.screen.bgPalette(BATTLE_BG_ATTRIBUTES[(y+Math.floor(py/8))*32+x+Math.floor(px/8)]);
    const colour=palette[(s.screen.bgp>>>(shade*2))&3];expected.set([...colour,255],at);
  }
  host.renderLiveBattle();expect(region(output.pixels,x*8,y*8)).toBe(hash(expected));
}
async function begin(lead=mon(),trainer=false){
  await world(trainer?'ViridianForest':'Route1',5,5,[lead]);
  if(trainer)host.startTrainerBattle('BUG_CATCHER',0,{endBattleLabels:{win:'ViridianForestYoungster2EndBattleText',lose:'ViridianForestYoungster2EndBattleText'}});
  else host.startBattle(mon(19,3));
  until(()=>host.state==='battle');return host.session!;
}
function menu(s:Session){until(()=>row(14).includes('FIGHT')&&!s.video.textBox.active);for(let i=0;i<30;i++)tick();}

it('starter Pikachu grows eight columns every two frames after Go, and main shows its back pixels',async()=>{
  const p=mon();p.otName='ASH';p.otId=0;
  const frames:Sample[]=[],original=send.pikachuEntrance;let ended=0,go=false;
  vi.spyOn(send,'pikachuEntrance').mockImplementation(function* (s,h){
    go=host.session!.textLog.some(t=>t.label==='GoText'&&t.complete);
    yield* observe(original(s,h),h.screen,frames,()=>{ended=frameNow();});
  });
  const s=await begin(p);until(()=>ended!==0);
  expect(go).toBe(true);expect(frames).toHaveLength(16);expect(ended-frames[0].at).toBe(16);
  const columns:(number|string)[][]=[
    [91,' ',' ',' ',' ',' ',' ',' '],[84,91,' ',' ',' ',' ',' ',' '],
    [77,84,91,' ',' ',' ',' ',' '],[70,77,84,91,' ',' ',' ',' '],
    [63,70,77,84,91,' ',' ',' '],[56,63,70,77,84,91,' ',' '],
    [49,56,63,70,77,84,91,' '],[' ',49,56,63,70,77,84,91],
  ];
  frames.forEach((f,i)=>{
    expect(f.at-frames[0].at).toBe(i);
    expect(sampleCells(f,0,5,8,7)).toEqual(Array.from({length:56},(_,j)=>{
      const tile=columns[Math.floor(i/2)][j%8];return typeof tile==='number'?tile+Math.floor(j/8):tile;
    }));
  });
  expect(cells(s.screen,1,5)).toEqual(full(49));for(let i=0;i<3;i++)tick();
  expect(cells(s.screen,1,5,7,7,true)).toEqual(full(49));expectPic(s,'back/25',1,5);
});

it('Pidgey lead writes single tile, 3x3, 5x5 and full pic after exactly 3/4/5 frames',async()=>{
  const original=send.sendingOutMon,frames:Sample[]=[];let ended=0;
  vi.spyOn(send,'sendingOutMon').mockImplementation(function* (s,h,x,y){
    yield* observe(original(s,h,x,y),h.screen,frames,()=>{ended=frameNow();});
  });
  const s=await begin(mon(16));until(()=>ended!==0);
  expect(frames).toHaveLength(12);expect(ended-frames[0].at).toBe(12);
  expect(sampleCells(frames[0],4,11,1,1)).toEqual([0x4d]);
  const small=[49,70,91,52,73,94,55,76,97];
  const medium=[49,56,70,84,91,50,57,71,85,92,52,59,73,87,94,54,61,75,89,96,55,62,76,90,97];
  for(let i=3;i<7;i++)expect(sampleCells(frames[i],3,9,3,3)).toEqual(small);
  for(let i=7;i<12;i++)expect(sampleCells(frames[i],2,7,5,5)).toEqual(medium);
  expect(s.state.mem[D.wDownscaledMonSize]).toBe(0);expect(s.state.mem[D.hBaseTileID]).toBe(0);
  expect(cells(s.screen,1,5)).toEqual(full(49));for(let i=0;i<3;i++)tick();expectPic(s,'back/16',1,5);
});

it('Forest trainer second mon sends a full front pic at 12,0 with base CF wrapping to zero',async()=>{
  const original=send.sendingOutMon,arrivals:{xy:number[];frames:Sample[];final:unknown[];base:number}[]=[];
  vi.spyOn(send,'sendingOutMon').mockImplementation(function* (s,h,x,y){
    const frames:Sample[]=[];yield* observe(original(s,h,x,y),h.screen,frames,()=>{
      if(s.mem[D.hStartTileID]===0xcf)arrivals.push({xy:[x,y],frames,final:cells(h.screen,12,0),base:s.mem[D.hBaseTileID]});
    });
  });
  const s=await begin(mon(25,45),true);
  until(()=>arrivals.length===2,()=>[...pulse()]);
  expect(arrivals.map(a=>a.xy)).toEqual([[15,6],[15,6]]);
  expect(arrivals.map(a=>a.base)).toEqual([207,207]);
  expect(arrivals[1].frames).toHaveLength(12);expect(arrivals[1].final).toEqual(full(0));
  expect(sampleCells(arrivals[1].frames[3],14,4,3,3)).toEqual([0,21,42,3,24,45,6,27,48]);
  expect(sampleCells(arrivals[1].frames[7],13,2,5,5)).toEqual([
    0,7,21,35,42,1,8,22,36,43,3,10,24,38,45,5,12,26,40,47,6,13,27,41,48,
  ]);
  for(let i=0;i<3;i++)tick();expect(cells(s.screen,12,0,7,7,true)).toEqual(full(0));
  expectPic(s,'front/10',12,0);
});

it('a flipped full send-out follows CopyUncompressedPicToHL column order on the real session',async()=>{
  const original=send.sendingOutMon;
  vi.spyOn(send,'sendingOutMon').mockImplementation(function* (s,h,x,y){s.mem[W_SPRITE_FLIPPED]=1;yield* original(s,h,x,y);});
  const s=await begin(mon(16));menu(s);expect(cells(s.screen,1,5)).toEqual(full(49,true));
});

it('switching starter Pikachu off uses eight three-frame tile steps and clears the last column',async()=>{
  const p=mon();p.otName='ASH';p.otId=0;await world('Route1',5,5,[p,mon(16)]);
  host.startBattle(mon(19,3));until(()=>host.state==='battle');const s=host.session!;menu(s);
  const original=slides.animationSlideMonOff,frames:Sample[]=[];let ended=0;
  vi.spyOn(slides,'animationSlideMonOff').mockImplementation(function* (state,screen){
    yield* observe(original(state,screen),screen,frames,()=>{ended=frameNow();});
  });
  openParty();tick(['down']);for(let i=0;i<3;i++)tick();tick(['a']);
  until(()=>ended!==0,()=>[...pulse()]);expect(frames).toHaveLength(24);
  expect(ended-frames[0].at).toBe(24);
  frames.forEach((f,i)=>expect(sampleCells(f,0,5,8,7)).toEqual(Array.from({length:56},(_,j)=>{
    const col=j%8,remaining=col+Math.floor(i/3)+1,tile=42+remaining*7+Math.floor(j/8);
    return col!==0&&col!==7&&tile<98?tile:' ';
  })));
  expect(cells(s.screen,0,5,8,7)).toEqual(Array(56).fill(' '));
});

it('a wild Safari mon running uses the enemy slide at three frames per step',async()=>{
  await world();host.startBattle(mon(19,3));const s=host.session!;s.state.wBattleType=2;
  until(()=>host.state==='battle');until(()=>row(14).includes('BALL')&&!s.video.textBox.active);
  // Safari's escape path: 2*speed>255 is unconditional in core.asm:249–279.
  s.state.wNumSafariBalls=10;s.state.mem[D.wEnemyMonSpeed+1]=128;
  const original=slides.animationSlideEnemyMonOff,frames:Sample[]=[];let ended=0;
  vi.spyOn(slides,'animationSlideEnemyMonOff').mockImplementation(function* (state,screen){
    yield* observe(original(state,screen),screen,frames,()=>{ended=frameNow();});
  });
  tick(['right']);for(let i=0;i<3;i++)tick();tick(['a']);
  until(()=>ended!==0,()=>[...pulse()]);expect(frames).toHaveLength(24);
  frames.forEach((f,i)=>expect(sampleCells(f,12,0,7,7)).toEqual(Array.from({length:49},(_,j)=>{
    const tile=(j%7)*7+Math.floor(j/7)-7*(Math.floor(i/3)+1);return tile>=0&&tile<48?tile:' ';
  })));
  expect(cells(s.screen,12,0)).toEqual(Array(49).fill(' '));expect(s.state.hWhoseTurn).toBe(0);
});

it('pins every ball animation id counted from constants/move_constants.asm',()=>{
  expect(balls.BALL_ANIMATION).toEqual({SHOWPIC:166,TOSS:193,SHAKE:194,POOF:195,BLOCKBALL:196,GREATTOSS:197,ULTRATOSS:198,HIDEPIC:200});
});

function ballObserver(){
  const original=balls.tossBallAnimation,frames:Sample[]=[],cues:number[]=[],order:string[]=[];let final=-1;
  vi.spyOn(balls,'tossBallAnimation').mockImplementation(function* (state,h){
    const sub=h.ballSubanimation;
    yield* observe(original(state,{...h,ballSubanimation:function* (id){
      cues.push(id);order.push(`cue ${id}`);yield* sub(id);
    }}),h.screen,frames,()=>{final=state.wAnimationID;});
  });
  const play=BattleAudio.prototype.play;
  vi.spyOn(BattleAudio.prototype,'play').mockImplementation(function(this:BattleAudio,sound){
    if(sound.id===0x95)order.push('thud');return play.call(this,sound);
  });
  return {frames,cues,order,get final(){return final;}};
}
it('actual Master Ball catch hides the enemy before ItemUseBallText05 with three shakes retained',async()=>{
  const b=ballObserver();await world();host.bag.items=[{id:'MASTER_BALL',count:1}];host.startBattle(mon(19,3));until(()=>host.state==='battle');
  const caught=host.session!;
  until(()=>caught.textLog.some(t=>t.label==='ItemUseBallText05'),()=>{
    if(frameNow()%4)return [];
    if(row(14).includes('FIGHT')&&!caught.video.textBox.active)return row(16).includes('▶')?['a']:['down'];
    return ['a'];
  });
  expect(b.frames).toHaveLength(3);expect(cells(caught.screen,12,0)).toEqual(Array(49).fill(' '));
  expect(textBgTransfer.enabled).toBe(true);expect(cells(caught.screen,12,0,7,7,true)).toEqual(Array(49).fill(' '));
  expect(caught.state.mem[I.wNumShakes]).toBe(3);expect(b.final).toBe(194);expect(b.cues).toEqual([198,195,194]);
});

it.each([{data:0x63,item:4,cues:[193,195,194,195],last:166,wait:6},
  {data:0x20,item:3,cues:[197,195],last:195,wait:0},
  {data:0x10,item:8,cues:[198],last:198,wait:0}])('session ball data $data item $item: exact hide/show waits and cue choice',async({data,item,cues,last,wait})=>{
  const s=await begin();menu(s);const before=cells(s.screen,12,0);host.renderLiveBattle();const beforeHash=region(output.pixels,96,0);
  const writes=vi.spyOn(s.screen,'put');
  const b=ballObserver();s.state.mem[I.wPokeBallAnimData]=data;s.state.mem[I.wCurItem]=item;s.state.hWhoseTurn=0;s.state.wAnimationID=0xc1;
  const program=s.animation(s.state);let next=program.next();
  for(let i=0;!next.done&&i<300;i++){tick();next=program.next();}
  expect(next.done).toBe(true);expect(b.frames).toHaveLength(wait);expect(b.cues).toEqual(cues);expect(b.final).toBe(last);
  expect(s.state.mem[I.wNumShakes]).toBe(data&15);expect(textBgTransfer.enabled).toBe(true);
  if(data===0x63){
    for(let i=0;i<3;i++)expect(sampleCells(b.frames[i],12,0,7,7)).toEqual(Array(49).fill(' '));
    for(let i=3;i<6;i++)expect(sampleCells(b.frames[i],12,0,7,7)).toEqual(full(0));
  }else{
    expect(writes.mock.calls.filter(([x,y,value])=>x>=12&&x<19&&y<7&&value===' ')).toEqual([]);
  }
  expect(cells(s.screen,12,0)).toEqual(before);host.renderLiveBattle();expect(region(output.pixels,96,0)).toBe(beforeHash);
});

it('trainer block plays toss, the existing faint-thud, then BLOCKBALL without changing the pic',async()=>{
  const s=await begin(mon(),true);menu(s);const before=cells(s.screen,12,0),b=ballObserver();
  s.state.wAnimationID=0xc1;s.state.hWhoseTurn=0;s.state.mem[I.wNumShakes]=9;
  const program=s.animation(s.state);let next=program.next();
  for(let i=0;!next.done&&i<300;i++){tick();next=program.next();}
  expect(next.done).toBe(true);expect(b.frames).toHaveLength(0);expect(b.final).toBe(196);
  expect(b.order).toEqual(['cue 193','thud','cue 196']);expect(s.state.mem[I.wNumShakes]).toBe(9);
  expect(cells(s.screen,12,0)).toEqual(before);
});
