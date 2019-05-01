/*
 * Copyright (C) 2019 Jaroslav Peter Prib
 */
function routeAdmin(msg) {
	this.log("routeAdmin "+JSON.stringify(msg.payload));
	switch (msg.payload.action) {
		case "add":
			addRoute.apply(this,[msg.payload]);
			break;
		default:
			this.error("unknown action "+JSON.stringify(msg.payload));
	}
}
function simpleEqual(a,b) {
	var p;
	for(p in a) {
		if((p in b) && a[p] == b[p]) continue;
		 return false;
	}
	for(p in b) {
		if(p in a) continue;
		return false;
	}
	return true
}
function addRoute(override) {
	for(var r of this.dynamicPaths) {
		if(simpleEqual(r.override,override)) {
			this.warn("route already defined, activated if deactivated");
			this.paths[r.path].status=1;
			return;
		}
	}
	var route=this.dynamicTemplate;
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
	
	var rnode=this;
	route.send=function(msg) {
		rnode.paths[msg.loadbalance].capacity++;
		if(msg.statusCode && msg.statusCode==200) {
			rnode.send([null,msg]);  // send to port 
			return;
		}
		rnode.error('Stopping path '+msg.loadbalance+" status code: "+msg.statusCode);
		rnode.paths[msg.loadbalance+1].status=0;
		setAvailable.apply(rnode);
		rnode.send([msg]);  // send admin port
	};
	delete override.action;
	this.dynamicPaths.push({node:this.dynamicTemplate,override:override,path:this.paths.length});
	addPath.apply(this);
	this.routes++;
	this.logicalPorts++;
	setAvailable.apply(this);
}

function addPath() {
	this.paths.push({status:1,capacity:this.defaultcapacity,baseCapacity:this.defaultcapacity,count:0,history:Array(3).fill({count:0,capacity:this.defaultcapacity,status:1})})
}

function updatePath(data) {
	try {
		if(Array.isArray(data)) {
			for(var a of data) {
				updatePath.apply(this,[a]);
			}
		} else {
			if(data.hasOwnProperty('status') && data.status!=this.paths[data.path].status) {
				if(data.status) {  
					this.warn("Available path "+data.path);
				} else {
					this.warn("Unavailable path "+data.path);
				}
			}
			Object.assign(this.paths[data.path],data);
			if(data.capacity) {
				this.paths[data.path].baseCapacity=data.capacity;
			}
		} 
	} catch(e) {
		this.error("loadbalance update failed: "+e +" data:"+data);
	}	
}
function setAvailable() {
	var available=[];
	for(var i=0;i<this.routes;i++) {
		if(this.paths[i].status) {
			available.push(i);
		}
	}
	this.available=available;
	var routes=this.dynamicRouting?this.dynamicPaths.length:this.routes;
	this.status({ fill: (this.available.length?(this.available.length==routes?'green':'yellow'):'red'), shape: 'dot', text: "Routes: "+routes + " Available: "+this.available.length});
}

var setPaths={
	random:	function() {
			this.path=Math.floor(Math.random()*this.available.length);
			return this.path;
	},
	next: function() {
		if(--this.path<0) {
			this.path=this.available.length-1;
		}
		return this.path;
	},
	foldweighted: function() {
		for(this.path=0;this.path<this.available.length;this.path++) {
			if(this.paths[this.available[this.path]].capacity>0) return this.path;
		}
		return this.pathNoCapacity.apply(this);
	},
	nextsmoothed:function() {
		for(var i=0;i<this.available.length;i++) {
        	if(--this.path<0) {
        		this.path=this.available.length-1;
       		}
			if(this.paths[this.available[this.path]].capacity>=this.pathCapacityAvg) {
				return this.path;
			}
		}
		return this.pathNoCapacity.apply(this);
	},
	admin:function() {
		return -1; // port assigned to admin
	},
	discard:function() {
		return -2; // by placing on none existent port
	}
}

function mpsCheckLoop(node) { 
	try{
		for(var n,c=0,i=0;i<node.routes;i++) {
			n=node.paths[i];
			n.capacity=n.baseCapacity;
			if(n.status) {
				c+=n.capacity;
			}
		}
		node.pathCapacityAvg=node.available.length?c/node.available.length:0;
	} catch(e) {
		node.error("mpsCheckLoop error: "+e);
	}
}

function checkLoop(node) { 
	try{
       	for(var n,i=0;i<node.routes;i++) {
    		n=node.paths[i];
    		n.history.unshift({status:n.status,count:n.count,capacity:n.capacity});
    		n.history.pop();
    		n.count=0;
    	}
	} catch(e) {
		node.error("checkloop error: "+e);
		node.error(n);
	}
}

module.exports = function(RED) {
    function loadBalanceNode(n) {
        RED.nodes.createNode(this,n);
        var node=Object.assign(this,{path:0,paths:[],available:[],pathCapacityAvg:100,discards:0,dynamicPaths:[]},n);
        node.defaultcapacity=node.defaultcapacity||100;
        node.logicalPorts=node.outputs;
        node.dynamicRouting=(node.routes==1 && this.dynamic!=="");
       
        for(var i=0;i<node.routes;i++) {
        	addPath.apply(this);
        }
        node.orginalSend=node.send;
        if(node.dynamicRouting) {
            updatePath.apply(node,[{path:0,status:0}]);
            node.send=function(msg) {
            	var i=msg.findIndex(v => v||false);
             	if(i<2) {
            		node.orginalSend.apply(node,[msg]);
            		return;
            	}
            	try{
            		var m=msg[i];
            		Object.assign(m,{loadbalance:i-2},node.dynamicPaths[i-2].override);
            		this.paths[m.loadbalance].capacity--;
            		node.dynamicTemplate.emit('input',m);
            	} catch(e) {
            		node.paths[i-1].status=0;
            		setAvailable.apply(node);
            		node.error("dynamic path made unavalable due to error "+e);
            	}
            }
        }
        setAvailable.apply(node);
		try{
			var setPath=setPaths[node.selection];
		} catch(e) {
			node.error("Selection mode not found: "+node.selection);
			var setPath=setPaths.random;
		}
		try{
			this.pathNoCapacity=setPaths[node.nocapacity];
			if(!this.pathNoCapacity) throw Error("not found");
		} catch(e) {
			node.error("No capacity selection mode not found, value: "+node.nocapacity);
			this.pathNoCapacity=setPaths.random;
		}
		try{
			this.pathNoAvailability=setPaths[node.noavailability];
			if(!this.pathNoAvailability) throw Error("not found");
		} catch(e) {
			node.error("No Availability selection mode not found, value: "+node.noavailability);
			this.pathNoAvailability=setPaths.admin;
		}
		RED.events.on("nodes-started",function() {
	        if(node.dynamicRouting) {
	            node.dynamicTemplate=RED.nodes.getNode(node.dynamic);
	            if(!node.dynamicTemplate) {
	            	node.error("Dynamic template node not found, id: "+this.dynamic);
	            }
	            node.dynamicTemplate.orginalsend=node.dynamicTemplate.send;
	            node.dynamicTemplate.send = function(msg) {
	            	if(msg.loaddbalance) {
		            	node.error("load balance port 1 send")
	            		node.orginalSend([null].append(msg));    // send to port 1
	            		return;
	            	}
	            	node.error("original send");
	            	node.dynamicTemplate.orginalsend.apply(node.dynamicTemplate,arguments);
	        	};
	        }
		});
        node.on('input', function (msg) {
            switch (msg.topic) {
        		case 'loadbalance':
        			updatePath.apply(node,[msg.payload]);
        			var t=0;
        			for(var r of node.routes) {
        				if(r.status) {
        					t+=r.capacity;
        				}
        			}
        			setAvailable.apply(node);
        			node.pathCapacityAvg=node.available.length?t/node.available.length:0;
        			node.orginalSend();
        			return;
        		case 'loadbalance.list':
        			msg.payload={discards:node.discards,capacityAverage:node.pathCapacityAvg,available:node.available,paths:node.paths};
    				node.orginalSend(msg);
        			return;
        		case 'loadbalance.debug':
    				node.error("selection mode: "+node.selection+"path pointer: "+node.path+" average capacity: "+node.pathCapacityAvg +" available: "+JSON.stringify(node.available) +" paths: "+JSON.stringify(node.paths));
    				node.orginalSend();
        			return;
        		case 'loadbalance.route':
        			routeAdmin.apply(node,[msg]);
    				node.orginalSend();
        			return;
            }
        	if(node.sticky && msg.req.cookies && msg.req.cookies[node.id]) {
       		 	var pathLastTime = Number(msg.req.cookies[node.id]);
       		 	if(node.paths[pathLastTime].status) {
       	        	var o=Array(node.outputs).fill(null).fill(msg,pathLastTime+1,pathLastTime+2);
       				node.send(o);
       	    		if(node.mpsCheck) {
       	    			node.paths[pathLastTime].capacity--;
       	    		}
       	    		return;
       		 	}
        	}
        	try{
               	var port=node.available[setPath.apply(node)];  //  offset for admin port		
            	node.paths[port].count++;
            	port++;
        	} catch(e) {
        		node.discards++;
        		if(node.available.length<1) { // then no Availability 
        			port=node.pathNoAvailability.apply(node);
        		}
        		if(port<-1) { // drop message
        			node.send();
        			return;
        		}
        		var port=0; // send to admin
        	}
        	if(node.sticky && port) {
        		 if(!msg.cookies) msg.cookies = {};
        		 msg.cookies[node.id]={ 
        			 value: port-1,
        			maxAge:360000    // 1 hour
        		 };
        		/*
        		 domain - (String) domain name for the cookie
        		 expires - (Date) expiry date in GMT. If not specified or set to 0, creates a session cookie
        		 maxAge - (String) expiry date as relative to the current time in milliseconds
        		 path - (String) path for the cookie. Defaults to /
        		 value - (String) the value to use for the cookie
        		*/
        	}
        	var o=Array(node.logicalPorts).fill(null).fill(msg,port,port+1);
			node.send(o);
    		if(node.mpsCheck) {
    			node.paths[port-1].capacity--;
    		}
        });
        node.check = setInterval(checkLoop, 60000 ,node); // check every minute

        if(node.mps && ['foldweighted','nextsmoothed'].includes(node.selection) ) {
        	node.mpsCheck = setInterval(mpsCheckLoop, 1000, node); // check every second
        	node.log("Established mps capacity");
        }
        node.on("close", function(removed,done) {
        	if(node.mpsCheck) {
        		clearInterval(node.mpsCheck)
        	}
        	clearInterval(node.check);
        	done();
        });
    }
    RED.nodes.registerType("Load Balance",loadBalanceNode);
};