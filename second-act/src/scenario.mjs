export const cohorts = [
  {id:'regulars',name:'The regulars',size:42,color:'#6966db',anchors:[{name:'The Grand Budapest Hotel',kind:'movie',year:2014},{name:'David Bowie',kind:'artist'}]},
  {id:'newcomers',name:'First-time guests',size:24,color:'#e78654',anchors:[{name:'Spirited Away',kind:'movie',year:2001},{name:'Joe Hisaishi',kind:'artist'}]},
  {id:'filmclub',name:'The quiet film club',size:12,color:'#39988e',anchors:[{name:'Perfect Days',kind:'movie',year:2023},{name:'Norwegian Wood',kind:'book'}]}
];
// All contracts, prices, cohorts and scores below are authored demonstration data.
const films = [
  ['wilderpeople','Hunt for the Wilderpeople',101,180,'Taika Waititi',2016,'Adventure / comedy','#416c59'],
  ['perfect-days','Perfect Days',124,190,'Wim Wenders',2023,'Quiet / human','#657bb1'],
  ['sing-street','Sing Street',106,160,'John Carney',2016,'Music / coming of age','#b9755a'],
  ['farewell','The Farewell',100,220,'Lulu Wang',2019,'Family / drama','#cf8d3f'],
  ['chef','Chef',114,175,'Jon Favreau',2014,'Food / comedy','#b74f3c'],
  ['after-yang','After Yang',96,240,'Kogonada',2021,'Reflective / sci-fi','#697971'],
  ['marcel','Marcel the Shell with Shoes On',90,150,'Dean Fleischer Camp',2021,'Warm / animation','#bf9278'],
  ['amelie','Amélie',122,180,'Jean-Pierre Jeunet',2001,'Romance / whimsical','#387565'],
  ['sunshine','Little Miss Sunshine',101,210,'Jonathan Dayton & Valerie Faris',2006,'Family / comedy','#c3973e'],
  ['princess','The Princess Bride',98,135,'Rob Reiner',1987,'Adventure / fantasy','#717293'],
  ['grand-budapest','The Grand Budapest Hotel',99,180,'Wes Anderson',2014,'Comedy / adventure','#c77b9b'],
  ['before-sunrise','Before Sunrise',101,130,'Richard Linklater',1995,'Conversation / romance','#64689d']
];
export const inventory = films.map(([id,title,runtime,cost,director,year,genre,color],i)=>({
  id,title,runtime,cost,director,year,genre,color,
  available:true,rightsConfirmed:true,rightsStart:'2026-10-01',rightsEnd:'2026-11-30',
  territory:'US',screeningsRemaining:1,contractRef:`DEMO-${String(i+1).padStart(3,'0')}`
}));
// The outage and two distinct rights blockers are deliberate testable conditions.
inventory.find(f=>f.id==='grand-budapest').rightsEnd='2026-10-20';
inventory.find(f=>f.id==='before-sunrise').territory='CA';
inventory.find(f=>f.id==='princess').screeningsRemaining=0;
const values = {
  'wilderpeople':[86,84,82], 'perfect-days':[70,63,100], 'sing-street':[100,93,43],
  'farewell':[77,82,91], 'chef':[87,86,54], 'after-yang':[68,79,97],
  'marcel':[80,91,87], 'amelie':[93,88,69], 'sunshine':[92,90,61],
  'princess':[89,94,38], 'grand-budapest':[97,75,65], 'before-sunrise':[76,68,94]
};
export const sampleSupport = Object.fromEntries(Object.entries(values).map(([id,v])=>[
  id,Object.fromEntries(cohorts.map((c,i)=>[c.id,{value:v[i],source:'sample'}]))
]));
export const incident = {
  id:'SA-014',originalTitle:'Moonrise Kingdom',venue:'The Lantern Cinema',
  reason:'Distributor withdrew the screening availability.',eventDate:'2026-10-24',startTime:'19:30',
  audience:78,description:'A sold-out community film night needs a replacement before doors open.'
};
export const constraints = {budget:220,maxRuntime:110,eventDate:incident.eventDate,territory:'US'};
export const scenario = {cohorts,inventory,incident,constraints,fairness:0.7};
