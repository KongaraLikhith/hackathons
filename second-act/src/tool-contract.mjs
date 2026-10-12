const film = {
  type:'object',
  properties:{
    id:{type:'string',minLength:1,maxLength:100},title:{type:'string',minLength:1,maxLength:200},
    runtime:{type:'number',exclusiveMinimum:0},cost:{type:'number',minimum:0},
    available:{type:'boolean'},rightsConfirmed:{type:'boolean'},
    rightsStart:{type:'string',format:'date'},rightsEnd:{type:'string',format:'date'},
    territory:{type:'string',minLength:1},screeningsRemaining:{type:'integer',minimum:0},
    qlooEntityId:{type:'string',format:'uuid'}
  },
  required:['id','title','runtime','cost','available','rightsConfirmed','rightsStart','rightsEnd','territory','screeningsRemaining']
};
const cohort = {
  type:'object',properties:{id:{type:'string',minLength:1,maxLength:100},name:{type:'string',minLength:1,maxLength:200},size:{type:'integer',minimum:1,maximum:10000},
    anchors:{type:'array',minItems:1,maxItems:2,items:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:200},kind:{enum:['movie','artist','book']},qlooEntityId:{type:'string',format:'uuid'}},required:['name','kind']}}
  },required:['id','name','size','anchors']
};
export const recoveryTool = {
  name:'Second Act recovery tool',
  description:'Resolve audience anchors, collect cultural rank evidence, check organizer-reported screening constraints, and propose a replacement for the example cancellation incident. Never books or sends.',
  endpoint:'/api/recover',method:'POST',contentType:'application/json',
  inputSchema:{type:'object',properties:{mode:{enum:['sample','live']},inventory:{type:'array',minItems:1,maxItems:20,items:film},cohorts:{type:'array',minItems:1,maxItems:3,items:cohort},
    constraints:{type:'object',properties:{budget:{type:'number',minimum:0},maxRuntime:{type:'number',exclusiveMinimum:0},eventDate:{type:'string',format:'date'},territory:{type:'string',minLength:1}},required:['budget','maxRuntime','eventDate','territory']},
    excludedIds:{type:'array',maxItems:20,items:{type:'string'}},fairness:{type:'number',minimum:0,maximum:1}},required:['mode']},
  outputDescription:'Ranked and blocked catalog candidates, decision metrics, repair options, evidence provenance and tool trace. Omitted catalog, audience or constraints use the authored example.'
};
