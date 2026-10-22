// Kept as an explicit migration helper: the source's new rows lacked required fields.
import { readFile, writeFile } from "node:fs/promises";
const file = "src/app/studio/catalog/page.tsx";
let code = await readFile(file, "utf8");
code = code.replace('setRows(x=>[...x,{id,name:"新条目",enabled:true}])', 'setRows(x=>[...x,kind==="products"?{id,name:"新商品",category:"零食",tags:[],price:0,stock:0,rating:0,description:"请补充商品说明"}:kind==="activities"?{id,name:"新活动",type:"threshold_reduction",threshold:99,discount:0,enabled:false,description:"请补充活动规则"}:{id,name:"新优惠券",threshold:0,discount:0,enabled:false,stackable:false}])');
code = code.replace('setSaved(r.ok?"已保存并创建版本":"保存失败")', 'const data=await r.json();setSaved(r.ok?"已保存并创建版本":data.error||"保存失败")');
await writeFile(file, code);
