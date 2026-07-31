import { TokenService } from "./src/security/token-service.mjs";
const [,,command,...args]=process.argv;
const value = name => { const i=args.indexOf(name); return i>=0 ? args[i+1] : undefined; };
if(command==="token") { const service=new TokenService(process.env.CONTROL12_FABRIC_SECRET||""); const scopes=(value("--scopes")||"").split(/\s+/).filter(Boolean); console.log(service.issue({tenant:value("--tenant")||"default",subject:value("--subject")||"operator",scopes,ttlSeconds:Number(value("--ttl")||3600)})); }
else console.log("Usage: node cli.mjs token --tenant default --subject operator --scopes 'fabric.admin'");
