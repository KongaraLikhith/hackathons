import http from 'node:http';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const worker=(await import(pathToFileURL(path.resolve('dist/server/index.js')).href)).default;
const port=Number(process.env.PORT || 4173);
const server=http.createServer(async (req,res)=>{
  try {
    const body=req.method==='GET'||req.method==='HEAD'?undefined:req;
    const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers,...(body?{body,duplex:'half'}:{})});
    const result=await worker.fetch(request,process.env);
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500,{'content-type':'text/plain'});res.end('Local server request failed.');}
});
server.listen(port,'0.0.0.0',()=>console.log('Second Act: http://127.0.0.1:'+port));
