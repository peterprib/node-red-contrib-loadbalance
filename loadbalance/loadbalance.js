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
		return setPaths.random.apply(this);
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
		return setPaths.random.apply(this);
	},
	dropmessage:function() {
		return -1; // by placing on none existence wire
	}
}

module.exports = function(RED) {
    function loadBalanceNode(n) {
    	clonen=Object.assign({},n);
        RED.nodes.createNode(this,n);
      
        var node=Object.assign(this,{path:0,paths:[],available:[],pathCapacityAvg:100,discards:0},n);
        for(var i=0;i<node.routes;i++) {
        	node.paths.push({status:1,capacity:100,count:0,history:Array(3).fill({count:0,capacity:100,status:1})})
        }
        setAvailable(node);
		var setPath = function() {
			node.path=Math.floor(Math.random()*node.routes);
		};
		try{
			var setPath=setPaths[node.selection];
		} catch(e) {
			node.error("Selection mode not found: "+node.selection);
		}
        node.on('input', function (msg) {
            switch (msg.topic) {
        		case 'loadbalance':
        			updatePath.apply(node,[msg.payload]);
        			for(var t=0,i=0;i<node.routes;i++) {
        				if(node.status) {
        					t+=node.paths[i].capacity
        				} 
        			}
        			node.pathCapacityAvg=t?t/node.available.length:0;
        			setAvailable(node);
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
        	try{
               	var port=node.available[setPath.apply(this)];  //  offset for admin port		
            	node.paths[port].count++;
            	port++;
        	} catch(e) {
        		if(node.available.length>0) {
            		node.error("port: "+port+" error: "+e);
        		}
        		node.discards++;
        		var port=0;
        	}
        	var o=Array(node.outputs).fill(null).fill(msg,port,port+1);
			node.send(o);
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
        node.on("close", function(removed,done) {
        	clearInterval(node.check);
        	done();
        });
    }
    RED.nodes.registerType("Load Balance",loadBalanceNode);
};