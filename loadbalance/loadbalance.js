/*
 * Copyright (C) 2019 Jaroslav Peter Prib
 */

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
					this.error("Unavailable path "+data.path);
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
function setAvailable(node) {
	var available=[];
	for(var i=0;i<node.routes;i++) {
		if(node.paths[i].status) {
			available.push(i);
		}
	}
	node.available=available;
	node.status({ fill: (node.available.length?(node.available.length==node.routes?'green':'yellow'):'red'), shape: 'dot', text: "Routes: "+node.routes + " Available: "+node.available.length});
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

module.exports = function(RED) {
    function loadBalanceNode(n) {
        RED.nodes.createNode(this,n);
        var node=Object.assign(this,{path:0,paths:[],available:[],pathCapacityAvg:100,discards:0},n);
        node.defaultcapacity=node.defaultcapacity||100;
        for(var i=0;i<node.routes;i++) {
        	node.paths.push({status:1,capacity:node.defaultcapacity,baseCapacity:node.defaultcapacity,count:0,history:Array(3).fill({count:0,capacity:node.defaultcapacity,status:1})})
        }
        setAvailable(node);
		try{
			var setPath=setPaths[node.selection];
		} catch(e) {
			node.error("Selection mode not found: "+node.selection);
			var setPath=setPaths.random;
		}
		try{
			this.pathNoCapacity=setPaths[node.nocapacity];
		} catch(e) {
			node.error("No capacity selection mode not found: "+node.selection);
			this.pathNoCapacity=setPaths.random;
		}
		try{
			this.pathNoAvailability=setPaths[node.noavailability];
		} catch(e) {
			node.error("No capacity selection mode not found: "+node.selection);
			this.pathNoAvailability=setPaths.admin;
		}
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
        			setAvailable(node);
        			node.pathCapacityAvg=node.available.length?t/node.available.length:0;
        			node.send();
        			return;
        		case 'loadbalance.list':
        			msg.payload={discards:node.discards,capacityAverage:node.pathCapacityAvg,available:node.available,paths:node.paths};
    				node.send(msg);
        			return;
        		case 'loadbalance.debug':
    				node.error("selection mode: "+node.selection+"path pointer: "+node.path+" average capacity: "+node.pathCapacityAvg +" available: "+JSON.stringify(node.available) +" paths: "+JSON.stringify(node.paths));
    				node.send();
        			return;
            }
        	if(node.sticky && msg.req.cookies.hasOwnProperty(node.id)) {
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
        	var o=Array(node.outputs).fill(null).fill(msg,port,port+1);
			node.send(o);
    		if(node.mpsCheck) {
    			node.paths[port-1].capacity--;
    		}
        });
        function checkLoop() { 
        	for(var n,i=0;i<node.routes;i++) {
        		n=node.paths[node.path];
        		n.history.unshift({status:n.status,count:n.count,capacity:n.capacity});
        		n.history.pop();
        		n.count=0;
        	}
        }
        node.check = setInterval(checkLoop, 60000); // check every minute
        function mpsCheckLoop(node) { 
        	for(var n,c=0,i=0;i<node.routes;i++) {
        		n=node.paths[i];
        		n.capacity=n.baseCapacity;
        		if(n.status) {
            		c+=n.capacity;
        		}
        	}
        	node.pathCapacityAvg=node.available.length?c/node.available.length:0;
        }
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