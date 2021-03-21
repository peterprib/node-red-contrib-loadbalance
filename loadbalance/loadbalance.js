const logger = new (require("node-red-contrib-logger"))("loadbalance");
logger.sendInfo("Copyright 2021 Jaroslav Peter Prib");

const dynamicNodes=[];

function routeAdmin(msg) {
	logger.info({label:"routeAdmin",msg:msg})
//	this.log("routeAdmin "+JSON.stringify(msg.payload));
	switch (msg.payload.action) {
		case "add":
			addRoute.apply(this,[msg.payload]);
			break;
		default:
			this.error("unknown action "+JSON.stringify(msg.payload));
	}
}
function simpleEqual(a,b) {
	for(const p in a) {
		if((p in b) && a[p] == b[p]) continue;
		 return false;
	}
	for(const p in b) {
		if(p in a) continue;
		return false;
	}
	return true
}
function addRoute(override) {
	if(logger.active) logger.send({label:"addRoute",addOverride:override})
	delete override.action;
	for(const r of this.dynamicPaths) {
		const areSame=simpleEqual(r.override,override);
		if(logger.active) logger.send({label:"addRoute",areSame:areSame,routeOveride:r.override,addOverride:override})
		if(areSame) {
			if(logger.active) logger.send({label:"addRoute reset",route:r,path:this.paths[r.path]})
			this.warn("route already defined, activated if deactivated");
			this.paths[r.path].status=1;
			return;
		}
	}
	const route=this.dynamicTemplate;
	switch (route.type) {
		case 'http request' :
			if(!override.hasOwnProperty('url')) {
				this.error("http request requires url");
				return
			}
			break;
		default:
			this.error("invalid template type");
			return;
	}
	this.dynamicPaths.push({node:this.dynamicTemplate,override:override,path:this.paths.length});
	addPath.apply(this);
	this.routes++;
	this.logicalPorts++;
	setAvailable.apply(this);
	if(this.hash&&this.hashType=="pearson")
		this.hash=setPearsonHash(this.routes);
}

function addPath() {
	this.paths.push({status:1,capacity:this.defaultcapacity,baseCapacity:this.defaultcapacity,count:0,history:Array(3).fill({count:0,capacity:this.defaultcapacity,status:1})})
}

function updatePath(data) {
	try {
		if(Array.isArray(data)) {
			for(const a of data) {
				updatePath.apply(this,[a]);
			}
		} else {
			if(data.hasOwnProperty('status') && data.status!=this.paths[data.path].status) {
				this.warn((data.status?"A" : "Una")+"vailable path "+data.path);
			}
			Object.assign(this.paths[data.path],data);
			if(data.capacity) {
				this.paths[data.path].baseCapacity=data.capacity;
			}
		} 
	} catch(ex) {
		if(logger.active) logger.error({label:"updatePath",error:ex.message})
		this.error("loadbalance update failed: "+ex +" data: "+JSON.stringify(data));
	}	
}
function setAvailable() {
	let available=[];
	for(let i=0;i<this.routes;i++)
		if(this.paths[i].status)
			available.push(i);
	if(this.available.length==available.length){
		
	}
	this.available=available;
	const routes=this.dynamicRouting?this.dynamicPaths.length:this.routes;
	this.status({ fill: (this.available.length?(this.available.length==routes?'green':'yellow'):'red'), shape: 'dot', text: "Routes: "+routes + " Available: "+this.available.length});
}

const setPaths={
	random:	function() {
			this.path=Math.floor(Math.random()*this.available.length);
			return this.available[this.path]; 
	},
	next: function() {
		if(--this.path<0) {
			this.path=this.available.length-1;
		}
		return this.available[this.path]; 
	},
	foldweighted: function() {
		for(this.path=0;this.path<this.available.length;this.path++)
			if(this.paths[this.available[this.path]].capacity>0) 
				return this.available[this.path];
		return this.pathNoCapacity.apply(this);
	},
	hash:function(RED,node,msg) {
		try{
			const key=this.sourceMap(RED,node,msg);
			this.path=this.hash(key);
			if(key==null) throw Error("key is null");
			if(logger.active) logger.send({label:" hash",path:this.path,key:key||"<null/undefined>"})
		} catch(ex) {
			if(logger.active) logger.error({label:" hash",error:ex.error})
			throw ex;
		}
		const path=this.paths[this.path];
		if(path.status && path.capacity>0)
			return this.path;
		return setPaths.random.apply(this);
	},
	nextsmoothed:function() {
		for(let i=0;i<this.available.length;i++) {
			if(--this.path<0)
				this.path=this.available.length-1;
			if(this.paths[this.available[this.path]].capacity>=this.pathCapacityAvg)
				return this.available[this.path]; 
		}
		return this.pathNoCapacity.apply(this);
	},
	admin:()=>-1,
	discard:()=>-2
}
const noAvailablityAction={
	admin:function(node,msg) {
		if(logger.active) logger.send({label:"No availablity send to admin port"})
		node.send([msg]);
	},
	discard:function(node) {
		if(logger.active) logger.send({label:"No availablity discard message"})
		node.send([]);
	}
}

function mpsCheckLoop(node) { 
	try{
		let c;
		for(c=0,i=0;i<node.routes;i++) {
			const n=node.paths[i];
			n.capacity=n.baseCapacity;
			if(n.status)
				c+=n.capacity;
		}
		node.pathCapacityAvg=node.available.length?c/node.available.length:0;
	} catch(ex) {
		if(logger.active) logger.error({label:"mpsCheckLoop",error:ex.message})
		node.error("mpsCheckLoop error: "+ex.message);
	}
}

function checkLoop(node) { 
	try{
		for(let i=0;i<node.routes;i++) {
			const n=node.paths[i];
			n.history.unshift({status:n.status,count:n.count,capacity:n.capacity});
			n.history.pop();
			n.count=0;
		}
	} catch(ex) {
		if(logger.active) logger.error({label:"checkLoop",error:ex.message})
		node.error("checkloop error: "+ex.message+" node: "+JSON.stringify(n));
	}
}
function pearsonHash(routes){
	const Hash=require("./pearsonHash");
	const hash=new Hash(routes);
	return hash.hashFunction();
}
function fvnHash(routes){
	const Hash=require("./fvnHash");
	const pearsonHash=new fvnHash().steMax(routes);
	return hash.hashFunction();;
}
function setHash(node){
	if(logger.active) logger.send({label:"setHash",selection:node.selection,hashType:node.hashType,routes:node.routes})
	if(node.selection!=="hash") return
	if(node.available.length==0){
		node.hash=()=>-2;
		return
	}
	const maxRoute=node.available.length
	switch (node.hashType) {
	case "pearson": 
		node.hash=pearsonHash(maxRoute);
		break;
	case "fvn": 
		node.hash=pearsonHash(maxRoute);
		break;
	default:
		throw Error("unknown hash type "+node.hashType);
	}
}
module.exports = function(RED) {
	 function loadBalanceNode(n) {
		RED.nodes.createNode(this,n);
		const node=Object.assign(this,{path:0,paths:[],available:[],pathCapacityAvg:100,discards:0,dynamicPaths:[]},n);
		node.defaultcapacity=node.defaultcapacity||100;
		node.logicalPorts=node.outputs;
		if(typeof node.routes == "string")
			node.routes=parseInt(node.routes); 
		node.dynamicRouting=(node.routes==1 && this.dynamic!=="")
		for(let i=0;i<node.routes;i++)
			addPath.apply(this);
		const orginalSend=node.send;
		node.orginalSend=orginalSend;
		if(node.dynamicRouting) {
			dynamicNodes.push(this);
			updatePath.apply(node,[{path:0,status:0}]);
			node.send=function(msg=[]) {
				let i=msg.findIndex(v => v||false);
				if(logger.active) logger.send({label:"dynamic send",msg:msg})
				if(node.lastMsgId && msg._msgid==node.lastMsgId) throw Error("Loop");
				node.lastMsgId=msg._msgid;
				if(i==-1) {
					if(logger.active) logger.send({label:"dynamic send discard"})
					node.orginalSend.apply(node,[]);
					return;
				}
				if(i==0) {
					if(logger.active) logger.send({label:"dynamic send admin"})
					node.orginalSend.apply(node,[msg]);
					return;
				}
				try{
					if(logger.active) logger.send({label:"dynamic send",path:i,paths:node.paths,dynamicPaths:node.dynamicPaths.length})
					const m=msg[i];
					const routeOffset=i-2;
					Object.assign(m,{loadbalance:routeOffset},node.dynamicPaths[routeOffset].override);
					this.paths[m.loadbalance].capacity--;
					node.dynamicTemplate.emit('input',m);
				} catch(ex) {
					if(logger.active) logger.error({label:"dynamic send error",error:ex.message,routes:node.dynamicPaths.length,stack:ex.stack})
					node.paths[routeOffset+1].status=0;
					setAvailable.apply(node);
					node.error("dynamic path made unavalable due to error "+ex.message);
					node.pathNoAvailability(node,msg)
				}
			}
			setHash(node);
		}
		setAvailable.apply(node);
		let setPath;
		try{
			setPath=setPaths[node.selection];
		} catch(ex) {
			if(logger.active) logger.error({label:"setPath default to random",error:ex.message})
			node.error("Selection mode not found: "+node.selection);
			setPath=setPaths.random;
		}
		try{
			if(node.selection=="hash") {
				if(logger.active) logger.send({label:"set up hash function",hashType:node.hashType,sourceProperty:node.sourceProperty})
				node.sourceMap=eval("(RED,node,msg)=>"+(node.sourceProperty||"msg.topic"));
				setHash(node)
//				node.hash="(RED,node,msg)=>"+(node.sourceProperty||"msg.topic");
			}
		} catch(ex) {
			if(logger.active) logger.error({label:"set up hash function",hashType:node.hashType,sourceProperty:node.sourceProperty})
			node.error("hash source mapping,  "+ex.message);
		}
		try{
			node.pathNoCapacity=setPaths[node.nocapacity];
		} catch(ex) {
			if(logger.active) logger.error({label:"set pathNoCapacity",error:ex.message})
			node.error("No capacity selection mode not found, value: "+node.nocapacity);
			this.pathNoCapacity=setPaths.random;
		}
		try{
			node.pathNoAvailability=noAvailablityAction[node.noavailability];
		} catch(ex) {
			if(logger.active) logger.error({label:"set pathNoAvailability",error:ex.message})
			node.error("No Availability selection mode not found, value: "+node.noavailability);
			node.pathNoAvailability=noAvailablityAction.admin;
		}
		 node.on('input', function (msg) {
			switch (msg.topic) {
			case 'loadbalance':
				updatePath.apply(node,[msg.payload]);
				let t=0;
				for(const r in node.routes)
					if(r.status) 
						t+=r.capacity;
				setAvailable.apply(node);
				node.pathCapacityAvg=node.available.length?t/node.available.length:0;
				node.orginalSend();
				return;
			case 'loadbalance.list':
				msg.payload={discards:node.discards,capacityAverage:node.pathCapacityAvg,available:node.available,paths:node.paths};
				node.orginalSend(msg);
				return;
			case 'loadbalance.debug':
				node.error("selection mode: "+node.selection+" path pointer: "+node.path+" average capacity: "+node.pathCapacityAvg +" available: "+JSON.stringify(node.available) +" paths: "+JSON.stringify(node.paths));
				node.orginalSend();
				return;
			case 'loadbalance.route':
				routeAdmin.apply(node,[msg]);
				node.orginalSend();
				return;
			case 'debug.on':
				logger.setOn()
				return;
			case 'debug.off':
				logger.setOff()
				return;
			}
			if(node.available.length<1) { // then no Availability 
				node.pathNoAvailability(node,msg);
				return;
			}
			let route,routeNumber;
			try{
				if(msg.loadbalance) throw Error("potential loop")
				if(node.sticky && msg.req && msg.req.cookies && msg.req.cookies[node.id]) {
						const pathLastTime = Number(msg.req.cookies[node.id]);
						if(node.paths[pathLastTime].status) {
							const o=Array(node.outputs).fill(null).fill(msg,pathLastTime+1,pathLastTime+2);
							node.send(o);
							if(node.mpsCheck)
								node.paths[pathLastTime].capacity--;
							return;
						}
				}
				routeNumber=setPath.apply(node,[RED,node,msg]);
				if(routeNumber<0) throw Error("")
						route=node.paths[routeNumber];
					if(logger.active) logger.send({label:"input process",routeNumber:routeNumber,route:route})
					route.count++; 
			} catch(ex) {
				node.discards++;
				if(logger.active) logger.send({label:"input process error",error:ex.message,routeNumber:routeNumber,discards:node.discards,available:node.available.length,stack:ex.stack})
				if(routeNumber==-2) // no capacity issue
					noAvailablityAction.discard(node,msg)
				else
					noAvailablityAction.admin(node,msg)
				return;
			}
			if(node.sticky) {
				if(logger.active) logger.send({label:"input process sticky"})
				if(!msg.cookies) msg.cookies = {};
				msg.cookies[node.id]={ 
					 value: routeNumber,
					maxAge:360000	 // 1 hour
				};
				/*
				 domain - (String) domain name for the cookie
				 expires - (Date) expiry date in GMT. If not specified or set to 0, creates a session cookie
				 maxAge - (String) expiry date as relative to the current time in milliseconds
				 path - (String) path for the cookie. Defaults to /
				 value - (String) the value to use for the cookie
				*/
			}
			const o=Array(routeNumber+2).fill(null,routeNumber).fill(msg,routeNumber+1,routeNumber+2);
			node.send(o);
			if(node.mpsCheck)
				route.capacity--;
		});
		node.check = setInterval(checkLoop, 60000 ,node); // check every minute

		if(node.mps && ['foldweighted','nextsmoothed'].includes(node.selection) ) {
			node.mpsCheck = setInterval(mpsCheckLoop, 1000, node); // check every second
			node.log("Established mps capacity");
		}
		node.on("close", function(removed,done) {
			if(node.mpsCheck)
				clearInterval(node.mpsCheck)
			clearInterval(node.check);
			done();
		});
	 }
	RED.events.on("flows:started",function() {
		dynamicNodes.forEach((node)=>{
			try{
				if(node.dynamicRouting) {
					node.dynamicTemplate=RED.nodes.getNode(node.dynamic);
					if(!node.dynamicTemplate) {	
						node.error("Dynamic template node not found, id: "+this.dynamic);
						return;
					}
					if(node.id== node.dynamicTemplate.id) {
						node.error("Dynamic template node points to same node causing loop, id: "+this.dynamic);
						return
					}
					node.dynamicTemplateOrginalSend=node.dynamicTemplate.send;
					if(node.dynamicTemplateOrginalSend==null) {
						node.error("Dynamic template node has no send,  id: "+this.dynamic);
						logger.error({label:"Dynamic template node no send ",node:node.dynamicTemplate.name||node.dynamicTemplate.id,properties:Object.keys(node.dynamicTemplate)})
						return;
					}
					node.dynamicTemplate.send=function(msg) { // add wrapper to see if message routed by load balancer
						if(logger.active) logger.send({label:"Dynamic template node send ",node:node.dynamicTemplate.name||node.dynamicTemplate.id})
						if(msg.loadbalance==null) { 
							if(logger.active) logger.error({label:"Dynamic template node send original path",node:node.dynamicTemplate.name||node.dynamicTemplate.id})
							node.dynamicTemplateOrginalSend.apply(node.dynamicTemplate,arguments);
						} else {  // load balance originated so send to load balance port 1
							if(logger.active) logger.error({label:"Dynamic template node send reroute to load balancer node",statusCode:msg.statusCode,node:node.dynamicTemplate.name||node.dynamicTemplate.id})
							if(node.mpsCheck)	node.paths[msg.loadbalance].capacity--;
							if(msg.statusCode && msg.statusCode==200) {
								node.orginalSend([null,msg]);	 // send to port 1
							} else {
								if(logger.active) logger.error({label:"Dynamic template node send error stop path ",statusCode:msg.statusCode,node:node.dynamicTemplate.name||node.dynamicTemplate.id})
								node.error('Stopping path '+msg.loadbalance+" status code: "+msg.statusCode+"  node: "+JSON.stringify(node.dynamicPaths[msg.loadbalance]));
								node.paths[msg.loadbalance+1].status=0;
								setAvailable.apply(node);
								node.orginalSend([msg]);  // send admin port
							}
						}
					};

					if(logger.active) logger.send({label:"Dynamic template node set send ",node:node.dynamicTemplate.name||node.dynamicTemplate.id})
				}
			} catch(ex){
				node.error("flows:started error: "+ex.message);
			}
		});
	});
	 RED.nodes.registerType("Load Balance",loadBalanceNode);
};